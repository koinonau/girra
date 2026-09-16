cask "girra@rc" do
  arch arm: "arm64", intel: "x64"

  version "1.4.36-rc.3"
  sha256 arm:   "563b6b14323fc9d5489299c82442d514bc12cabffc9d06d3964ed572af4b3955",
         intel: "457088c7021f07de1a419197f7b2bd00092741ad4727d4fef3d86af38a6831e7"

  url "https://github.com/stablyai/orca/releases/download/v#{version}/girra-macos-#{arch}.dmg",
      verified: "github.com/stablyai/orca/"
  name "Girra RC"
  desc "IDE for orchestrating AI coding agents across terminals and worktrees"
  homepage "https://onorca.dev/"

  livecheck do
    url "https://github.com/stablyai/orca"
    regex(/^v?(\d+(?:\.\d+)+-rc\.\d+)$/i)
    strategy :github_releases do |json, regex|
      json.map do |release|
        next if release["draft"]
        next unless release["prerelease"]

        match = release["tag_name"]&.match(regex)
        next if match.blank?

        match[1]
      end
    end
  end

  # Why: RC installs should follow Girra's prerelease-aware updater instead of
  # waiting for Homebrew metadata churn between frequent release candidates.
  auto_updates true
  conflicts_with cask: "girra"
  depends_on macos: :big_sur

  app "Girra.app"

  # Why: expose the bundled CLI on PATH at install time (Homebrew symlinks these
  # into its already-on-PATH bin dir). Without it, the CLI is only registered
  # by the in-app "Install CLI" action, which a headless host can never trigger —
  # so `girra serve` on a server would be unreachable from the shell. The shim
  # resolves the real app by walking symlinks, so the Homebrew symlink works.
  # Why both names: hook scripts and SSH hosts written against `orca` keep working.
  binary "#{appdir}/Girra.app/Contents/Resources/bin/girra"
  binary "#{appdir}/Girra.app/Contents/Resources/bin/orca"

  # Why: Girra writes user data under ~/.orca (worktrees, agent state) and
  # Electron's standard userData directories. Zap removes everything the app
  # creates during normal use so `brew uninstall --zap` is a clean slate.
  zap trash: [
    "~/.orca",
    "~/Library/Application Support/Girra",
    "~/Library/Caches/com.koinonau.girra",
    "~/Library/Caches/com.koinonau.girra.ShipIt",
    "~/Library/HTTPStorages/com.koinonau.girra",
    "~/Library/Preferences/com.koinonau.girra.plist",
    "~/Library/Saved Application State/com.koinonau.girra.savedState",
  ]
end
