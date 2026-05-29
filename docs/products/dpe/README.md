# QuesIQ DPE

QuesIQ DPE should be imported as its own product lane inside the shared QuesIQ
platform.

## Target Lane

Use:

- `src/features/dpe/`
- product-owned routes under the future app product route structure
- DPE-specific database tables keyed by shared Auth.js `user.id`

## Boundaries

QuesIQ DPE has a distinct audience and may later justify a separate native app
listing for app-store positioning. That does not require a separate web service
now.

QuesIQ DPE owns its own:

- aviation/DPE content model
- oral-exam practice sessions
- pilot progress records
- DPE-specific prompts/AI calls
- DPE-specific admin views

Shared platform owns auth, account, product selection, billing when added, and
common shell behavior.
