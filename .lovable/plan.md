

# Remove Login Page Photo

Remove the entire left-side photo panel from the login page, making the login form full-width.

## Changes

### `src/pages/Login.tsx`
- Delete lines 88–104 (the left illustration `div` containing the hero image, gradient overlay, and text)
- Remove the `farmhouseHero` import (line 5)
- Change the right panel from `lg:w-1/2` to full width (`w-full`, remove the `lg:w-1/2`)

