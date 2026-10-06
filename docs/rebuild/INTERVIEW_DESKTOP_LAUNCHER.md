# Interview desktop launcher

Double-click **QuesIQ Interview** on the Windows desktop. The PowerShell menu offers:

1. Start Expo for the installed phone development app, using the hosted Interview API.
2. Start Expo with a cleared Metro cache when JavaScript changes appear stale. Stop the old Expo window first.
3. Check Node, npm, installed Expo, and whether port 8081 is occupied.
4. Leave PowerShell open in `apps/mobile` for troubleshooting commands.
5. **Hotel / travel connection**: start Expo through an internet tunnel. Both devices need internet, but can use different networks (including phone cellular).

For hotel Wi-Fi, choose **5** and scan the new QR code. Complete any hotel Wi-Fi
sign-in page first. Stop an existing Expo window with `Ctrl+C` before switching
connection modes. Tunnels can be slower and some networks block them. The tunnel
URL is public; share it only with intended testers and stop the server when done.
Expo uses the globally installed `@expo/ngrok` helper for this option.

For phone testing, connect the PC and phone to the same private Wi-Fi, choose 1,
and open the installed QuesIQ development app through the displayed QR code.
Keep the terminal open while testing. Press `r` to reload, or `Ctrl+C` to stop.
This requires the QuesIQ development build; Expo Go cannot run this app.
If Windows asks about Node network access, allow it on your trusted private network.
VPNs or guest Wi-Fi isolation can prevent the phone reaching the PC.

The launcher reads the public API URL from `apps/mobile/eas.json` and sets it for
this PowerShell process. App actions connect to that hosted backend. It does not
start a backend, install dependencies, build/sign the native app, or enable AI.
The PowerShell execution-policy override applies only to this window.

From the mobile-folder prompt, show the menu again with:

```powershell
& ..\..\scripts\open-interview.ps1
```

Use `npm.cmd` for manual npm commands. Errors stay visible because the shortcut
keeps PowerShell open. Share the relevant error text when troubleshooting, omitting
passwords, tokens and personal session content.

Recreate the shortcut after moving the repository by running this from its root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-interview-shortcut.ps1
```

Verification on 2026-09-24: Windows PowerShell check mode passed; installed Expo
CLI supports the selected arguments. Shortcut target/arguments were read back.
Phone connection and native app behavior require a device retest.

Travel option verified on 2026-09-24: installed global `@expo/ngrok` 4.1.3,
added process-local NODE_PATH discovery for Expo's Windows global-package lookup,
and started the actual launcher in Travel mode. Expo reported `Tunnel connected`
and `Tunnel ready` and displayed a development-build QR code. Stopped the server
after verification; hotel-network and phone behavior remain device checks.
