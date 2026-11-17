import { expect, test } from '../../src/fixtures';

// The page is customer-facing with a lot of phone traffic. These checks run on every project, and
// matter most on the phone profiles (Pixel 7, iPhone 14): the content must fit the screen width.
test.describe('signup form: layout', () => {
  test('L-01 does not scroll horizontally', async ({ signupPage: p }) => {
    await expect.poll(() => p.horizontalOverflow()).toBe(0);
  });

  test('L-02 keeps every control inside the viewport width', async ({ signupPage: p, page }) => {
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    for (const control of p.controls) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      expect(box, 'control has no layout box').not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
    }
  });

  test('L-03 the longest validation message does not break the layout', async ({
    signupPage: p,
    newUser,
    copy,
  }) => {
    // passwordComposition is the longest message in both languages.
    await p.fillForm(newUser({ password: 'abcdefghij12' }));
    await p.submit.click();

    await expect(p.password).toHaveAccessibleDescription(copy.errors.passwordComposition);
    await expect.poll(() => p.horizontalOverflow()).toBe(0);
  });
});
