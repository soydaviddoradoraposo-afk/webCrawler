# Example Exploration Plan

## Metadata

- Name: Example Application Exploration
- Version: 1.0.0
- Description: Basic exploration of a sample web application
- BaseUrl: https://example.com

## Safety

- Forbidden Actions: delete, destroy, remove
- Forbidden Selectors: [data-action="delete"], button.delete, .destructive
- Allow Destructive Forms: false
- Allow Delete Buttons: false

## Steps

- goto: https://example.com
- click: login-button
- fill: username-field admin
- fill: password-field secret123
- click: submit-button
- waitFor: navigation
- click: dashboard-link
- waitFor: networkidle
