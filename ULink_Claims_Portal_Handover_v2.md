# ULink Claims Portal — Full Project Handover Document

**Prepared by:** AI Software Engineer  
**Date:** March 2026  
**Version:** 2.0 — Updated with latest fixes and new features  
**Status:** ✅ Fully Live in Production

---

## 1. Project Overview

### Purpose
The **ULink Claims Portal** is a web-based internal tool that allows all ULink staff to submit three types of claims:

| Tab | Purpose |
|---|---|
| **OIL (Off-In-Lieu)** | Claim compensatory leave hours for overtime worked |
| **OPD (Out-Patient Department)** | Claim medical/outpatient treatment reimbursement |
| **Employee Claims / Provider Payment** | Employee expense claims or payment requests to providers |

### Main Objectives
- Simple, mobile-friendly online form for staff to submit claims
- Automated notification and approval/rejection process via email
- Live Google Sheets tracking for each claim type
- Secure document storage in Microsoft OneDrive (OPD + Claims)
- Prevent duplicate approvals with a one-time lock system

### Stakeholders

| Role | Who |
|---|---|
| **Claim Submitters** | All ULink staff |
| **Approvers (OIL/OPD)** | gm@ulinkassist.com, finance@ulinkassist.com |
| **Approvers (Claims)** | Tan Chien Wei, Galvin Moh, or Sharon (selected per submission) |
| **System Email** | ulink.assistform@gmail.com |

---

## 2. Architecture Overview

```
[Browser / Staff]
      │
      ▼ HTTP POST (multipart/form-data)
[Node.js + Express on Render]
      │
      ▼ Forwards to n8n webhook
[n8n Cloud (ulink.app.n8n.cloud)]
      ├─► Validates fields
      ├─► Uploads file → Microsoft OneDrive (Graph API)
      ├─► Creates shareable link (view, organization scope)
      ├─► Appends row → Google Sheets
      └─► Sends HTML email with Approve / Reject buttons
                │
                ▼ (Approver clicks button)
         [n8n Approval Webhook]
              ├─► Reads row from Sheet
              ├─► Checks if already decided (lock)
              ├─► Updates claimStatus column
              └─► Returns branded confirmation HTML page
```

**Auto-Deploy Pipeline:**
```
Code change → Push to GitHub → Render detects → Auto-deploys in ~2 min
```

---

## 3. Features

### OIL Claim Form
- Fields: staff name, date applied, OIL date, hours claimed, reason
- Conditional time picker: shown only for partial-day claims (< 10 hrs)
- Auto-calculates "To Time" based on hours entered
- Approval: email to `gm@ulinkassist.com` and `finance@ulinkassist.com`
- Tracker: `/oil-tracker.html` (password: `0000`) → OIL Google Sheet

### OPD Claim Form
- Fields: staff name, treatment date, amount (any currency), medical condition/diagnosis
- **Upload label:** "Upload Discharge / Medical Note with Receipt"
- **Upload:** Drag-and-drop or browse — JPG, PNG, PDF, max 10MB
- **OneDrive:** File uploaded to `/odp/` folder; a **shareable organization link** is created and stored in the sheet for approvers to click "View Document" in email
- **Email:** HTML email to GM + Finance with Approve/Reject buttons and clickable "View Document" link
- **Approval:** Clicking Approve → Updates `claimStatus` to "Approved" → Shows branded ✅ confirmation page
- **Lock:** Once approved or rejected, all subsequent clicks show "🔒 Already Processed"
- Tracker: `/opd-tracker.html` (password: `0000`) → OPD Google Sheet

### Employee Claims / Provider Payment Tab
- Fields: employee name, type (Employee Expense / Provider Payment), submission date, payment incurred date (calendar picker, optional), description, entity, currency, amount, payment mode, card digits *(only required if Ulink Credit Card selected)*, approver (dropdown)
- **Upload:** Drag-and-drop or browse — JPG, PNG, PDF, max 10MB
- **OneDrive:** File uploaded to `/claims 2026/` folder; shareable link stored in sheet
- **Email:** Sent to the **selected approver only** (Tan Chien Wei / Galvin Moh / Sharon) with claim detail table and "View Document" link
- **Approval:** Same one-time lock system as OPD
- Tracker: `/claims-tracker.html` (password: `0000`) → Claims Google Sheet

### Email Approval System (All 3 Claim Types)
- Branded HTML email with gradient header, detail table, Approve/Reject buttons
- Clicking a button calls `n8n/webhook/{type}-approve?decision=Approved&...`
- A new n8n "Prepare Response" node captures the decision **before** the Google Sheets node overwrites the data, so the confirmation page always shows the **correct** decision (Approved ✅ or Rejected ❌)
- One-time lock: first click wins; all subsequent shown "🔒 Already Processed"

---

## 4. Current Production Status

| Feature | Status |
|---|---|
| OIL claim submission | ✅ Live |
| OPD claim submission | ✅ Live |
| Employee Claims submission | ✅ Live |
| OIL email approval + lock | ✅ Live |
| OPD email approval + lock | ✅ Live |
| Employee Claims approval + lock | ✅ Live |
| OPD "View Document" link (shareable) | ✅ Live |
| Claims "View Document" link (shareable) | ✅ Live |
| OPD upload to OneDrive `/odp/` | ✅ Live |
| Claims upload to OneDrive `/claims 2026/` | ✅ Live |
| OIL Tracker (password-gated) | ✅ Live |
| OPD Tracker (password-gated) | ✅ Live |
| Claims Tracker (password-gated) | ✅ Live |
| Deployed on Render | ✅ `oil-8b06.onrender.com` |

---

## 5. File Structure

```
/additional hours
├── server.js                          ← Node.js/Express backend
├── .env                               ← Webhook URLs (not in git)
├── package.json
├── public/
│   ├── index.html                     ← Main portal (OIL + OPD + Claims tabs)
│   ├── style.css                      ← All styling
│   ├── oil-tracker.html               ← Password gate → OIL Sheet
│   ├── opd-tracker.html               ← Password gate → OPD Sheet
│   └── claims-tracker.html            ← Password gate → Claims Sheet
├── n8n_oil_submission_workflow.json
├── n8n_oil_approval_workflow.json
├── n8n_opd_submission_workflow.json   ← Includes "Create Shareable Link" node
├── n8n_opd_approval_workflow.json     ← Includes "Prepare Response" node (fix)
├── n8n_claims_submission_workflow.json ← Uploads to OneDrive /claims 2026/
└── n8n_claims_approval_workflow.json
```

---

## 6. n8n Workflow Reference

### How to Import a Workflow
1. Log in to [ulink.app.n8n.cloud](https://ulink.app.n8n.cloud)
2. Go to **Workflows → Import from file**
3. Select the relevant `.json` file
4. **Reconnect credentials** (see below)
5. Click **Activate**

### Credentials to Reconnect After Every Import

| Credential Type | Used In | n8n Credential Name |
|---|---|---|
| Microsoft OneDrive OAuth2 | OPD + Claims submission workflows | `Microsoft OneDrive account` |
| Google Sheets OAuth2 | All submission + approval workflows | `Google Sheets account 2` |
| Gmail OAuth2 | All submission workflows | `Gmail account` |

> ⚠️ **Important:** Credentials are stored in n8n, not in the JSON files. IDs are placeholders (`REPLACE_WITH_YOUR_CREDENTIAL_ID`). Reconnect every time you re-import.

### OPD Submission Workflow — Node Chain
```
Webhook → Validate OPD Fields → Upload Receipt to OneDrive
→ Create Shareable Link → Extract Drive Link
→ Append Row to OPD Sheet → Build Notification Email
→ Send Notification Email → Respond Success
```

### OPD Approval Workflow — Node Chain
```
Webhook → Parse Approval Request → Read Current Row
→ Check If Already Decided → Is Not Yet Decided?
  ├─ YES → Update Claim Status → Prepare Response → Build Confirmation Page
  └─ NO  → Build Confirmation Page (already processed)
→ Respond — Confirmation Page
```

> **Key fix:** "Prepare Response" node re-reads `decision` and `staffName` from "Check If Already Decided" *after* the Google Sheets update node, because the Sheets node overwrites input data. Without this node, the confirmation page always showed "Rejected / undefined".

### Claims Submission Workflow — Node Chain
```
Webhook → Validate & Map Fields → Upload Document to OneDrive (claims 2026)
→ Extract Drive Link → Append Row to Google Sheet
→ Build Notification Email → Send Notification Email → Respond Success
```

---

## 7. Google Sheets & OneDrive Reference

| Data Store | Sheet ID / Folder | URL |
|---|---|---|
| OIL Sheet | `12KpoT4P4iGxabIlwERKuV2F0MmBkQKmiuCso36sG5-o` | [Open Sheet](https://docs.google.com/spreadsheets/d/12KpoT4P4iGxabIlwERKuV2F0MmBkQKmiuCso36sG5-o/edit) |
| OPD Sheet | `1hhokFjoAiZlFTRf4KEmOmR4bReOwtbuzuEfzvrGUHqA` | [Open Sheet](https://docs.google.com/spreadsheets/d/1hhokFjoAiZlFTRf4KEmOmR4bReOwtbuzuEfzvrGUHqA/edit) |
| Claims Sheet | `17smy-n931rC_5MNod2kJkYv3qaB7DxJMgjoYKrVysok` | [Open Sheet](https://docs.google.com/spreadsheets/d/17smy-n931rC_5MNod2kJkYv3qaB7DxJMgjoYKrVysok/edit) |
| OPD OneDrive | `/odp/` folder | Files named: `Name_Date_OPD_Receipt.pdf` |
| Claims OneDrive | `/claims 2026/` folder | Files named: `Name_Date_Claim.pdf` |

### Required Google Sheet Columns

**OPD Sheet (Sheet1):**
`staffName | treatmentDate | treatmentAmount | diagnosis | submittedAt | claimStatus | receiptLink`

**Claims Sheet (Sheet1):**
`employeeName | type | submissionDate | paymentDate | description | entity | currency | amount | paymentMode | cardDigits | approver | approverEmail | submittedAt | claimStatus | documentLink`

---

## 8. Environment Variables

Set in **Render → Service → Environment**:

| Variable | Value |
|---|---|
| `N8N_OIL_WEBHOOK` | `https://ulink.app.n8n.cloud/webhook/submit` |
| `N8N_OPD_WEBHOOK` | `https://ulink.app.n8n.cloud/webhook/opd-submit` |
| `N8N_CLAIMS_WEBHOOK` | `https://ulink.app.n8n.cloud/webhook/claims-submit` |
| `PORT` | Set automatically by Render |

---

## 9. Live Links

| Resource | URL |
|---|---|
| **Claims Portal** | https://oil-8b06.onrender.com |
| **OIL Tracker** (pw: `0000`) | https://oil-8b06.onrender.com/oil-tracker.html |
| **OPD Tracker** (pw: `0000`) | https://oil-8b06.onrender.com/opd-tracker.html |
| **Claims Tracker** (pw: `0000`) | https://oil-8b06.onrender.com/claims-tracker.html |
| **n8n Dashboard** | https://ulink.app.n8n.cloud |
| **GitHub Repository** | https://github.com/ulinksupport/oil |

---

## 10. Known Issues & Limitations

| Issue | Severity | Notes |
|---|---|---|
| **n8n OneDrive node bug** | Medium | Native n8n OneDrive node has a Content-Type bug for binary uploads. **Always use HTTP Request node with Microsoft Graph API.** Do not switch to the native node. |
| **n8n credential re-linking** | Low | After every workflow JSON re-import, credentials must be manually reconnected in n8n UI |
| **OneDrive OAuth2 token expiry** | Low | Token may expire after long inactivity. Fix: n8n → Credentials → Reconnect Microsoft OneDrive |
| **Render free-tier cold start** | Low | First request after 15 min inactivity may take 30–60 sec. Consider upgrading Render plan |
| **Client-side password gate** | Low | Tracker page passwords are checked in browser JS — sufficient for internal use, not enterprise-grade |
| **submittedAt as row key** | Low | Approvals match by exact timestamp. Two simultaneous submissions at the same millisecond would conflict (extremely rare) |

---

## 11. Common Operations

### Check Claim Status
1. Go to the relevant tracker page or open the Google Sheet directly
2. New rows appear at the bottom; `claimStatus` column: `Pending Review / Approved / Rejected`

### Approve or Reject a Claim
1. Open the notification email
2. Click **✅ APPROVE** or **❌ REJECT**
3. Confirmation page opens — Sheet updates automatically
> ⚠️ First click wins. All subsequent clicks will show "Already Processed."

### If a Workflow Fails
1. Log in to [ulink.app.n8n.cloud](https://ulink.app.n8n.cloud)
2. Open the relevant workflow → **Executions** tab
3. Click the failed run → identify the failing node
4. Check credentials are still connected (most common cause)

### Deploy a Code Change
```bash
git add .
git commit -m "describe your change"
git push origin main
# Render auto-deploys within ~2 minutes
```

### Change a Tracker Password
1. Open `public/oil-tracker.html`, `public/opd-tracker.html`, or `public/claims-tracker.html`
2. Find: `const ACCESS_PASSWORD = '0000';`
3. Change the value and push to GitHub

### Add/Change an Approver (Claims)
1. Open `n8n_claims_submission_workflow.json`
2. In the **"Validate & Map Fields"** code node, update:
```js
const approverEmails = {
  'Tan Chien Wei': 'cw.tan@ulinkassist.com',
  'Galvin Moh':    'gm@ulinkassist.com',
  'Sharon':        'finance@ulinkassist.com'
};
```
3. Also update the `<select>` dropdown in `public/index.html` (Claims tab)
4. Re-import workflow + reconnect credentials

---

## 12. Recommended Future Improvements

| Priority | Improvement |
|---|---|
| 🔴 High | Send **confirmation email to the staff member** when their claim is approved or rejected |
| 🔴 High | Add **multi-level approval** (Manager approves → Finance confirms) |
| 🟡 Medium | Proper **admin dashboard** to filter, search, export all claims |
| 🟡 Medium | **Monthly summary report** auto-emailed to HR/Finance |
| 🟡 Medium | Replace client-side password gate with **server-side login** (session-based) |
| 🟢 Low | Replace Google Sheets with a proper **database** (Supabase/PostgreSQL) |
| 🟢 Low | **SMS notifications** via Twilio when a claim is submitted/approved |

---

*Document prepared March 2026 — ULink Claims Portal v2.0. For change history, refer to GitHub commit log at [github.com/ulinksupport/oil/commits/main](https://github.com/ulinksupport/oil/commits/main).*
