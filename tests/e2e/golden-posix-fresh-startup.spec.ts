import { expect, test } from './helpers/orca-app'

test.skip(process.platform === 'win32', 'POSIX fresh-startup golden; Windows has its own suite')

test.describe('POSIX fresh startup golden', () => {
  test.use({ seedExistingUserProfile: false, seedTestRepo: false })

  test('fresh profile reaches Landing normally @posix-profile-index-golden', async ({
    orcaPage
  }) => {
    await expect(orcaPage.getByText('Add a project to get started.')).toBeVisible({
      timeout: 30_000
    })
  })
})
