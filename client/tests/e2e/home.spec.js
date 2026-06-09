import { test, expect } from '@playwright/test';

test('Home page loads and displays products', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Gigantya/); // Adjust title if different

  // Check if at least one product is displayed
  const products = page.locator('.product-card'); // Adjust selector based on actual CSS
  await expect(products.first()).toBeVisible();
});

test('User can open a product modal', async ({ page }) => {
  await page.goto('/');
  const firstProduct = page.locator('.product-card').first();
  await firstProduct.click();

  const modal = page.locator('.product-modal'); // Adjust selector
  await expect(modal).toBeVisible();
});
