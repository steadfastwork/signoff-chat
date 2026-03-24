# App Store Submission — Signoff Chat

## Quick reference

| Thing           | Value                              |
|-----------------|------------------------------------|
| App name        | Signoff Chat                       |
| Bundle ID       | com.signoffchat.app                |
| Android package | com.signoffchat.app                |
| Category        | Social Networking                  |
| Age rating      | 17+                                |
| Price           | Free (Gold IAP: $4.99/mo)          |
| Primary locale  | en-US                              |

---

## EAS build commands

### Prerequisites

```bash
npm install -g eas-cli
eas login
eas whoami   # confirm account
```

All commands run from `apps/mobile/`.

### Development build (dev client, internal)

Internal testers only. Runs against dev API.
Installs via Expo Go-replacement dev client.

```bash
# iOS — physical device
eas build --profile development --platform ios

# Android — APK, sideload directly
eas build --profile development --platform android

# Both at once
eas build --profile development --platform all
```

### Preview build (production API, internal distribution)

Use to validate before App Store submission.
Same API/keys as production. Distributed as IPA + APK via EAS.

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
eas build --profile preview --platform all
```

Install on devices via the EAS dashboard link or `eas build:resign`.

### Production build (App Store + Play Store)

- iOS: signed IPA for App Store / TestFlight
- Android: `.aab` (App Bundle) for Play Store

```bash
# Build
eas build --profile production --platform ios
eas build --profile production --platform android
eas build --profile production --platform all

# Submit immediately after build completes
eas submit --profile production --platform ios
eas submit --profile production --platform android

# Build + submit in one command
eas build --profile production --platform ios --auto-submit
eas build --profile production --platform android --auto-submit
```

`autoIncrement: true` in `eas.json` bumps `versionCode` / `buildNumber` automatically.

---

## App Store (iOS) submission steps

### 1. Certificates and provisioning (first time only)

```bash
eas credentials --platform ios
# Choose: "Manage credentials" → let EAS handle everything (recommended)
# EAS creates: Distribution Certificate + App Store provisioning profile
```

### 2. Create the App Store record

1. Log in to [App Store Connect](https://appstoreconnect.apple.com).
2. **Apps → +** → **New App**.
3. Fill in:
   - Platform: iOS
   - Name: `Signoff Chat`
   - Primary language: English (U.S.)
   - Bundle ID: `com.signoffchat.app`
   - SKU: `signoffchat-ios-001`
4. Save.

### 3. App information

- **Category**: Social Networking (primary), Entertainment (secondary)
- **Age Rating**: 17+ (see justification below)
- **Privacy Policy URL**: `https://signoffchat.com/privacy`
- **Support URL**: `https://signoffchat.com/support`
- **Marketing URL**: `https://signoffchat.com`

### 4. Pricing and availability

- Price: Free
- Availability: All territories (or adjust as needed)

### 5. App metadata (copy-paste ready)

**Name**
```
Signoff Chat
```

**Subtitle** (30 chars max)
```
speak freely. disconnect proudly.
```

**Description**
```
SIGNOFF.CHAT

Remember when the internet felt like going somewhere?

── AWAY MESSAGES ARE BACK ──
Set your status. Say what you mean. Sign off.
"out. back when i'm back."

── BUDDY LIST. NOT FOLLOWERS. ──
Both of you say yes. No vanity metrics. No strangers in your feed.

── CHANNELS ──
Real-time chatrooms — public, invite-only, or secret.
Invite links expire. Slow mode keeps things thoughtful.
Messages expire from our servers in 30 days.
Your device keeps everything. Screenshots are king.

── BOARDS ──
Your corner of the internet. Post, comment, nudge.
No upvotes. No scores. No algorithm.
Founding members get a badge — forever.
One sentence sets the vibe. The right people find it.

── ACTUALLY PRIVATE ──
AES-256 + ML-KEM post-quantum hybrid encryption.
The same approach used by Apple and Signal.
We cannot read your messages. Not us. Not anyone.
No ads. No tracking. No data selling.
We make money from $4/month Gold memberships. That's it.

── THE OLD SCHOOL PART ──
Write down your screenname — we can't recover it.
Screenshot what matters — it won't live on our servers forever.
Sign off when you're done — that's the whole point.

GOLD MEMBERSHIP — $4/month
Profile photo · custom themes · ★ badge
90-day server history · emoticon packs · priority support
Cancel anytime.
```

**Keywords** (100 chars max, comma-separated)
```
chat,messaging,retro,away message,buddy list,encrypted,post-quantum,boards,channels,privacy,minimal
```

**What's New** (first release)
```
First release. Welcome.
```

### 6. Screenshots

Required sizes for App Store Connect:

| Device              | Size (px)      | Count  |
|---------------------|----------------|--------|
| iPhone 6.5"         | 1284 × 2778    | 5      |
| iPhone 5.5"         | 1242 × 2208    | 5      |
| iPad Pro 12.9" 3rd+ | 2048 × 2732    | 5      |

Screenshot content and captions (in order):

1. **Feed** — "your people. not an algorithm."
2. **Invite-only channel** — "rooms worth being in."
3. **Board detail** — "your corner of the internet."
4. **Buddy list** — "buddies. not followers."
5. **Registration / onboarding** — "write it down. sign off. go live."

App Store captions go in the "Screenshot Description" field under each screenshot.
Keep them under 255 characters.

### 7. App icon

- 1024 × 1024 px PNG, no alpha channel, no rounded corners (Apple clips it)
- Design: `S/` in amber (#f5c842) on near-black (#0d0d0b) background
- Reference SVG: `assets/icon-1024.svg` (to be created)
- Export PNG: `assets/icon-1024.png` → upload to App Store Connect
- The `icon.png` in `assets/` (referenced in `app.json`) is used by Expo for all other icon sizes

### 8. Privacy manifest (PrivacyInfo.xcprivacy)

Create `ios/PrivacyInfo.xcprivacy` (or add via EAS managed workflow):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeEmailAddress</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeUsername</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array/>
</dict>
</plist>
```

**App Store Connect — Data collection answers:**

| Data type          | Collected | Linked to user | Used for tracking |
|--------------------|-----------|----------------|-------------------|
| Email address      | Yes       | Yes            | No                |
| Username           | Yes       | Yes            | No                |
| Precise location   | No        | —              | —                 |
| Contacts           | No        | —              | —                 |
| Browsing history   | No        | —              | —                 |
| Search history     | No        | —              | —                 |
| Purchase history   | No        | —              | —                 |
| Sensitive info     | No        | —              | —                 |
| Device ID          | No        | —              | —                 |
| Crash data         | No        | —              | —                 |
| Performance data   | No        | —              | —                 |

### 9. In-App Purchases (Gold membership)

1. App Store Connect → **In-App Purchases → +**
2. Type: **Auto-Renewable Subscription**
3. Reference name: `Gold Membership`
4. Product ID: `com.signoffchat.app.gold_monthly`
5. Subscription group: `Gold`
6. Price: $3.99/month (Tier 4) — maps to local ~$4/month
7. Localization → Display name: `Gold Membership`
8. Description: `★ badge, profile photo, 90-day history, and more. Cancel anytime.`

> The Stripe flow handles payments on the server side.
> The iOS IAP record is required for App Store compliance even if Stripe processes
> the transaction. For pure compliance without Apple's 30% cut, the subscription
> is managed server-side via Stripe; the IAP record may need to be the primary
> billing mechanism depending on Apple's review interpretation. Consult Apple's
> guidelines on "reader apps" and external payment links before launch.

### 10. Reviewer notes

Paste this verbatim into the "Notes for App Review" field:

```
Test account credentials:
  Screenname: reviewer
  Password:   [set a dedicated reviewer account before submission]
  Server:     https://signoffchat.com

Design notes for reviewers:
- This app intentionally omits "last seen" timestamps and does not store
  IP addresses. Messages expire from our servers in 30 days by design and
  are retained locally on device. This is documented in our privacy policy.
  Not a bug.

- The registration flow requires a screenname only. Email is optional and
  stored as a one-way hash for account recovery purposes only. We cannot
  retrieve or display the email address. This is intentional.

- Channels labeled "SECRET" are invite-only and not publicly discoverable.
  This is equivalent to a private group chat, not hidden illegal content.

- Push notifications require explicit user permission and are opt-in per
  category (buddy requests, nudges, replies, etc.) in Settings.

- The app uses Expo's managed workflow. There is no custom native code
  beyond the listed third-party SDKs (Stripe, Expo modules).
```

### 11. Submit for review

```bash
eas submit --profile production --platform ios
```

Or submit the built IPA manually via Transporter (macOS app).

---

## TestFlight

### Internal testing (up to 100 testers, no review needed)

```bash
eas build --profile production --platform ios
# After build completes, it appears in TestFlight automatically
```

1. App Store Connect → **TestFlight → Internal Testing → +**
2. Select the build
3. Add testers by Apple ID (or Groups)
4. They receive an email with a TestFlight link — no review

### External testing (up to 10,000 testers, Beta App Review needed)

1. App Store Connect → **TestFlight → External Testing → +**
2. Select build → Add external testers or a public link
3. Submit for Beta App Review (usually 1–2 business days)
4. Once approved, share the public TestFlight link

**Beta review notes** — same as reviewer notes above. Add:
```
This is a beta build for external testing. Core features are complete.
Known missing: custom themes, emoticon packs (roadmap items).
```

---

## Play Store (Android) submission steps

### 1. Service account (first time only)

1. Google Play Console → Setup → API access → Link to Google Cloud project
2. Create a service account with **Release Manager** role
3. Download the JSON key → save as `apps/mobile/google-service-account.json`
4. Add to `.gitignore` — never commit this file

### 2. Create the app

1. [Play Console](https://play.google.com/console) → **Create app**
2. App name: `Signoff Chat`
3. Default language: English (United States)
4. App or game: App
5. Free or paid: Free
6. Declarations: check all that apply → Create app

### 3. Store listing

- **Short description** (80 chars): `speak freely. disconnect proudly.`
- **Full description**: same as App Store description above
- **Screenshots**: same 5 screenshots (Play Store accepts various sizes; min 320px wide)
- **Feature graphic**: 1024 × 500 px (create a dark banner with "Signoff Chat" in VT323)
- **Icon**: 512 × 512 px PNG (export from icon SVG)

### 4. Content rating

Play Console → Policy → App content → Content rating:
- Complete the questionnaire
- Category: Social → answer questions honestly
- Expected rating: **Mature 17+** (user-generated content, chat)

### 5. Data safety

Play Console → Policy → Data safety:

| Data                  | Collected | Shared | Required | Purpose       |
|-----------------------|-----------|--------|----------|---------------|
| Email address         | Yes       | No     | Yes      | Account management |
| Username              | Yes       | No     | Yes      | App functionality  |
| User messages         | No*       | No     | —        | —             |
| Location              | No        | No     | —        | —             |
| Financial info        | No†       | No     | —        | —             |

*Messages are encrypted on-device before transmission. Server cannot read content.
†Payment processing handled by Stripe; card data never touches our servers.

### 6. Submit

```bash
eas submit --profile production --platform android
```

Target track: **Production** (or start with **Internal testing → Closed testing → Open testing → Production**).

---

## Review timeline

| Platform   | Review type      | Typical duration        | Notes                              |
|------------|------------------|-------------------------|------------------------------------|
| iOS        | Initial review   | 1–3 business days       | Can be longer for new developers   |
| iOS        | Update review    | 24–48 hours             | Expedited review available         |
| iOS        | Beta App Review  | 1–2 business days       | Required for external TestFlight   |
| Android    | Initial review   | 3–7 days                | Longer for new developer accounts  |
| Android    | Update review    | Hours–2 days            | Usually fast once established      |

**If rejected:**
- Apple: respond in Resolution Center, do not resubmit without a change
- Google: address the policy issue noted, resubmit with explanation
- Both reviewers respond by email — check the registered Apple ID / Play Console email

**Expedited review (iOS only):**
Available for legitimate urgent issues (critical bug, legal requirement).
App Store Connect → App Review → Contact Us → Request expedited review.
Do not use for routine submissions.

---

## 17+ age rating — justification

The 17+ rating is appropriate and required for the following reasons:

**User-generated content (UGC)**
Signoff Chat is an open communication platform. Users can post, comment, and send messages with no AI content moderation. While we have a reporting system, the app cannot guarantee that all content is appropriate for younger audiences. This matches Apple's and Google's UGC policy requirements.

**Real-time chat**
The channel and direct message features allow real-time communication with strangers (public channels). Apple requires 17+ for apps with "unrestricted web access" or UGC without comprehensive moderation.

**Explicit content policy**
Our Terms of Service prohibit CSAM and illegal content. CSAM reports are escalated immediately (automated email to abuse@signoffchat.com with X-Priority: 1). However, the platform does not pre-screen content, which is the threshold Apple uses for the 17+ rating.

**Mature themes**
Away messages and posts are free-form text. Adult themes may appear. We cannot guarantee G-rated content.

**What we do NOT have** (to confirm rating is not higher than necessary):
- No simulated gambling
- No alcohol/drug references in our own content
- No horror/frequent intense violence
- No sexual content in our own UI

The 17+ rating is the correct, honest rating for a UGC social platform with real-time chat and no automated content moderation.

---

## Pre-launch checklist

- [ ] `EXPO_PUBLIC_PROJECT_ID` set in EAS secrets (for push notifications)
- [ ] `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` set in EAS secrets (production key)
- [ ] `EXPO_PUBLIC_SOKETI_KEY` and `EXPO_PUBLIC_SOKETI_HOST` set in EAS secrets
- [ ] Apple Developer account: paid ($99/yr), certificates created via `eas credentials`
- [ ] `appleId`, `ascAppId`, `appleTeamId` filled in `eas.json` → `submit.production.ios`
- [ ] `google-service-account.json` downloaded and path set in `eas.json` → `submit.production.android`
- [ ] App icon 1024×1024 PNG (no alpha) exported to `assets/icon-1024.png`
- [ ] 5 screenshots captured at 1284×2778 (iPhone 14 Pro Max or simulator)
- [ ] TestFlight internal build tested end-to-end on physical device
- [ ] Push notification flow tested (login → register → receive test notification)
- [ ] Stripe Payment Sheet tested with test card `4242 4242 4242 4242`
- [ ] Reviewer account created at `https://signoffchat.com/register`
- [ ] Privacy policy live at `https://signoffchat.com/privacy`
- [ ] Support URL live at `https://signoffchat.com/support`
- [ ] `PrivacyInfo.xcprivacy` added to Xcode project (managed workflow: via expo-build-properties)
- [ ] `google-service-account.json` in `.gitignore`
- [ ] EAS secrets set for all `EXPO_PUBLIC_*` vars (not hardcoded in `eas.json`)

---

## EAS secrets (production values go here, not in eas.json)

```bash
# Set secrets via EAS CLI (stored encrypted, injected at build time)
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value "pk_live_..."
eas secret:create --scope project --name EXPO_PUBLIC_SOKETI_KEY --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_SOKETI_HOST --value "ws.signoffchat.com"
eas secret:create --scope project --name EXPO_PUBLIC_PROJECT_ID --value "..."

# List secrets
eas secret:list

# The EXPO_PUBLIC_API_URL is safe to keep in eas.json since it's not a credential
```

The blank values in `eas.json` (`"EXPO_PUBLIC_SOKETI_KEY": ""`) are intentional placeholders — EAS secrets override them at build time.
