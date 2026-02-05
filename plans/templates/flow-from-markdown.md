# Markdown E2E Flow Example

This is an example Markdown flow file for E2E testing.
Each line is a natural language prompt that will be executed sequentially.

## Login Flow

Navigate to https://example.com/login
Fill the username field with 'testuser'
Fill the password field with 'password123'
Click the 'Login' button
Wait for element with text 'Welcome'
Take a screenshot

## Navigation Flow

Navigate to https://example.com/dashboard
Click the 'Settings' link
Wait for element with text 'Settings'
Click the 'Profile' tab
Fill the email field with 'newemail@example.com'
Click the 'Save' button
Wait for element with text 'Profile updated'

## Form Submission Flow

Navigate to https://example.com/contact
Fill the name field with 'John Doe'
Fill the email field with 'john@example.com'
Fill the message field with 'This is a test message'
Click the 'Submit' button
Wait for element with text 'Thank you'
Take a screenshot

## E-commerce Flow

Navigate to https://example.com/products
Click the 'Add to Cart' button for 'Product 1'
Click the 'Cart' icon
Wait for element with text 'Shopping Cart'
Click the 'Checkout' button
Fill the shipping address field with '123 Main St'
Fill the city field with 'New York'
Fill the zip code field with '10001'
Click the 'Continue' button
Wait for element with text 'Payment'
Take a screenshot

## Notes

- Blank lines are ignored
- Lines starting with # are treated as comments
- Each prompt is executed sequentially
- Evidence (screenshots, HTML, logs) is captured per step
- MCP is used first, with automatic fallback to deterministic crawler
- Metadata can be added per line: #evidence: true, #timeout: 5000
