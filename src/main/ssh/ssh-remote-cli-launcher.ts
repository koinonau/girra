import type { RemoteHostPlatform } from './ssh-remote-platform'
import { isWindowsRemoteHost, joinRemotePath } from './ssh-remote-platform'
import { powerShellCommand, powerShellLiteral, powerShellNativeArg } from './ssh-remote-powershell'

type RemoteCliInstallEnv = {
  binDir: string
  relayDir: string
  nodePath: string
  sockPath: string
  credentialFile?: string
  hostPlatform: RemoteHostPlatform
}

type RemoteCliInstallFile = {
  path: string
  contents: string
}

export type RemoteCliInstallPlan = {
  launcherPath: string
  /** The current name, installed beside `launcherPath`, which keeps the pre-rename one. */
  aliasPath: string
  files: RemoteCliInstallFile[]
  postWriteCommands: string[]
}

// Why `orca` stays the primary: a host reached by a client that predates this install, or one
// whose refresh failed, has only that name, and the install is best-effort by design
// (`ssh-relay-session.ts` warns rather than failing the connection on a MaxSessions=1 remote).
export const REMOTE_CLI_ALIAS_NAMES = { posix: 'girra', win32: 'girra.exe' } as const

const WINDOWS_REMOTE_CLI_LAUNCHER_SOURCE = String.raw`using System;
using System.Diagnostics;
using System.IO;
using System.Text;

internal static class OrcaRemoteCliLauncher
{
    private static int Main(string[] args)
    {
        try
        {
            string nodePath = RequireEnvironmentVariable("GIRRA_RELAY_NODE_PATH");
            string relayDirectory = RequireEnvironmentVariable("GIRRA_RELAY_DIR");
            string socketPath = RequireEnvironmentVariable("GIRRA_RELAY_SOCKET_PATH");
            string credentialFile = Environment.GetEnvironmentVariable("GIRRA_RELAY_CREDENTIAL_FILE");
            if (String.IsNullOrEmpty(credentialFile))
            {
                credentialFile = socketPath + ".credential";
            }
            string relayPath = Path.Combine(relayDirectory, "relay.js");

            if (!File.Exists(nodePath))
            {
                Console.Error.WriteLine("Girra SSH CLI bridge cannot find Node.js at \"{0}\"", nodePath);
                return 1;
            }
            if (!File.Exists(relayPath))
            {
                Console.Error.WriteLine("Girra SSH CLI bridge cannot find the relay at \"{0}\"", relayPath);
                return 1;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = BuildArguments(relayPath, socketPath, credentialFile, args),
                UseShellExecute = false
            };

            using (Process child = Process.Start(startInfo))
            {
                child.WaitForExit();
                return child.ExitCode;
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("Unable to start the Girra SSH CLI bridge: {0}", error.Message);
            return 1;
        }
    }

    private static string RequireEnvironmentVariable(string name)
    {
        string value = Environment.GetEnvironmentVariable(name);
        if (String.IsNullOrEmpty(value))
        {
            throw new InvalidOperationException(name + " is not set.");
        }
        return value;
    }

    private static string BuildArguments(string relayPath, string socketPath, string credentialFile, string[] args)
    {
        StringBuilder commandLine = new StringBuilder();
        AppendArgument(commandLine, relayPath);
        AppendArgument(commandLine, "--sock-path");
        AppendArgument(commandLine, socketPath);
        AppendArgument(commandLine, "--credential-file");
        AppendArgument(commandLine, credentialFile);
        AppendArgument(commandLine, "--orca-cli");
        foreach (string arg in args)
        {
            AppendArgument(commandLine, arg);
        }
        return commandLine.ToString();
    }

    private static void AppendArgument(StringBuilder commandLine, string value)
    {
        if (commandLine.Length > 0)
        {
            commandLine.Append(' ');
        }
        commandLine.Append(QuoteArgument(value));
    }

    private static string QuoteArgument(string value)
    {
        bool requiresQuotes = value.Length == 0;
        for (int index = 0; index < value.Length && !requiresQuotes; index += 1)
        {
            requiresQuotes = value[index] == '"' || Char.IsWhiteSpace(value[index]);
        }
        if (!requiresQuotes)
        {
            return value;
        }

        StringBuilder quoted = new StringBuilder("\"");
        int backslashCount = 0;
        foreach (char character in value)
        {
            if (character == '\\')
            {
                backslashCount += 1;
                continue;
            }
            if (character == '"')
            {
                quoted.Append('\\', backslashCount * 2 + 1);
                quoted.Append('"');
            }
            else
            {
                quoted.Append('\\', backslashCount);
                quoted.Append(character);
            }
            backslashCount = 0;
        }

        quoted.Append('\\', backslashCount * 2);
        quoted.Append('"');
        return quoted.ToString();
    }
}
`

function quoteSh(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

function createWindowsLauncherCompileCommand(
  binDir: string,
  sourceFileName: string,
  launcherFileName: string,
  launcherPath: string,
  sourcePath: string,
  legacyShimPath: string,
  aliasPath: string
): string {
  // Why: legacy csc.exe mis-parses space-bearing absolute paths handed to it by
  // Windows PowerShell 5.1's native-argument quoting, so compile from the bin
  // directory and pass only the bare, space-free launcher file names.
  const compilerArgs = [
    '/nologo',
    '/target:exe',
    '/optimize+',
    '/warnaserror+',
    `/out:${launcherFileName}`,
    sourceFileName
  ]
    .map(powerShellNativeArg)
    .join(' ')
  return powerShellCommand(
    [
      `Set-Location -ErrorAction Stop -LiteralPath ${powerShellLiteral(binDir)}`,
      '$windowsDirectory = if ($env:WINDIR) { $env:WINDIR } else { $env:SystemRoot }',
      `$compilerCandidates = @((Join-Path $windowsDirectory 'Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'), (Join-Path $windowsDirectory 'Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'))`,
      '$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1',
      "if (-not $compiler) { Write-Error 'Unable to find the .NET Framework C# compiler required for the Girra SSH CLI launcher.'; exit 1 }",
      `& $compiler ${compilerArgs}`,
      'if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
      `if (-not (Test-Path -LiteralPath ${powerShellLiteral(launcherPath)} -PathType Leaf)) { Write-Error 'The Girra SSH CLI launcher compiler produced no executable.'; exit 1 }`,
      // Why copy rather than compile twice: the launcher never reads its own name, so one
      // build serves both, and a second csc.exe run would double the install's failure surface.
      `Copy-Item -LiteralPath ${powerShellLiteral(launcherPath)} -Destination ${powerShellLiteral(aliasPath)} -Force`,
      // Why: remove the legacy %* bridge only after a successful compile, so a
      // host missing csc.exe keeps its existing CLI (orca.exe shadows orca.cmd).
      `Remove-Item -LiteralPath ${powerShellLiteral(legacyShimPath)} -Force -ErrorAction SilentlyContinue`,
      `Remove-Item -LiteralPath ${powerShellLiteral(sourcePath)} -Force`
    ].join('; ')
  )
}

export function createRemoteCliInstallPlan(env: RemoteCliInstallEnv): RemoteCliInstallPlan {
  if (isWindowsRemoteHost(env.hostPlatform)) {
    const launcherFileName = 'orca.exe'
    const sourceFileName = 'orca-launcher.cs'
    const launcherPath = joinRemotePath(env.hostPlatform, env.binDir, launcherFileName)
    const sourcePath = joinRemotePath(env.hostPlatform, env.binDir, sourceFileName)
    const legacyShimPath = joinRemotePath(env.hostPlatform, env.binDir, 'orca.cmd')
    const aliasPath = joinRemotePath(env.hostPlatform, env.binDir, REMOTE_CLI_ALIAS_NAMES.win32)
    const binDir = joinRemotePath(env.hostPlatform, env.binDir)
    return {
      launcherPath,
      aliasPath,
      files: [{ path: sourcePath, contents: WINDOWS_REMOTE_CLI_LAUNCHER_SOURCE }],
      // Why: compiling on the Windows target avoids shipping an unsigned
      // cross-host binary while ensuring argv never crosses cmd.exe's parser.
      postWriteCommands: [
        createWindowsLauncherCompileCommand(
          binDir,
          sourceFileName,
          launcherFileName,
          launcherPath,
          sourcePath,
          legacyShimPath,
          aliasPath
        )
      ]
    }
  }

  const launcherPath = joinRemotePath(env.hostPlatform, env.binDir, 'orca')
  const aliasPath = joinRemotePath(env.hostPlatform, env.binDir, REMOTE_CLI_ALIAS_NAMES.posix)
  const script = [
    '#!/usr/bin/env sh',
    'set -eu',
    `GIRRA_RELAY_NODE_PATH=\${GIRRA_RELAY_NODE_PATH:-${quoteSh(env.nodePath)}}`,
    `GIRRA_RELAY_DIR=\${GIRRA_RELAY_DIR:-${quoteSh(env.relayDir)}}`,
    `GIRRA_RELAY_SOCKET_PATH=\${GIRRA_RELAY_SOCKET_PATH:-${quoteSh(env.sockPath)}}`,
    `GIRRA_RELAY_CREDENTIAL_FILE=\${GIRRA_RELAY_CREDENTIAL_FILE:-${quoteSh(env.credentialFile ?? `${env.sockPath}.credential`)}}`,
    'if [ ! -S "$GIRRA_RELAY_SOCKET_PATH" ]; then',
    '  echo "Girra SSH CLI bridge cannot find the relay socket: $GIRRA_RELAY_SOCKET_PATH" >&2',
    '  exit 1',
    'fi',
    'exec "$GIRRA_RELAY_NODE_PATH" "$GIRRA_RELAY_DIR/relay.js" --sock-path "$GIRRA_RELAY_SOCKET_PATH" --credential-file "$GIRRA_RELAY_CREDENTIAL_FILE" --orca-cli "$@"',
    ''
  ].join('\n')
  return {
    launcherPath,
    aliasPath,
    files: [
      { path: launcherPath, contents: script },
      { path: aliasPath, contents: script }
    ],
    // Surface chmod failures: a non-executable launcher must fail install loudly, not silently.
    postWriteCommands: [`chmod +x ${quoteSh(launcherPath)} ${quoteSh(aliasPath)}`]
  }
}
