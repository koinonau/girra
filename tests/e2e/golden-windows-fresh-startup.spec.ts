import { expect, test } from './helpers/orca-app'

test.use({ seedExistingUserProfile: false, seedTestRepo: false })
test.skip(process.platform !== 'win32', 'Fresh-profile fsync regression is Windows-only')

test('fresh Windows profile reaches Landing @windows-fresh-startup-golden', async ({
  orcaPage
}) => {
  await expect(orcaPage.getByText('Add a project to get started.')).toBeVisible({
    timeout: 30_000
  })
})
