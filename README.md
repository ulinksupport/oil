# OIL Tracker — Setup Guide

**Off-in-Lieu (OIL) Tracking System** — Render + n8n + Google Sheets + Google Drive + ChatGPT

## What This Is

A full internal tool for staff to submit OIL (overtime) claims, store approval evidence in Google Drive, track all records in a live Google Sheet, and let management query OIL balances via an AI chatbot.

---

## Project Structure

```
additional hours/
├── public/
│   ├── index.html       ← OIL submission form (staff use this)
│   ├── chat.html        ← AI OIL query chatbot (management use this)
│   ├── style.css        ← Shared dark glassmorphism styles
│   └── chat.js          ← Chat UI logic
├── server.js            ← Express server (file upload proxy + AI query proxy)
├── package.json
├── .env.example         ← Copy to .env and fill in values
├── n8n_oil_submission_workflow.json   ← Import into n8n (Workflow 1)
└── n8n_oil_query_workflow.json        ← Import into n8n (Workflow 2)
```

---

## Step 1: Google Sheets Setup

1. Create a new Google Sheet named **OIL_Tracker**
2. Add these headers in **Row 1** (one per column, A–I):

   | A | B | C | D | E | F | G | H | I |
   |---|---|---|---|---|---|---|---|---|
   | Staff Name | Date Applied | OIL Date Worked | OIL Time Worked | OIL Hours | Reason | Approval File Link | Validation Status | Submitted At |

3. Copy the **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_IS_YOUR_SHEET_ID`**`/edit`

---

## Step 2: Google Drive Setup

1. In Google Drive, create a folder called **`OIL Evidence`**
2. Inside it, create a subfolder for the current month, e.g. **`2026-02`**
3. Get the folder ID from the URL: `https://drive.google.com/drive/folders/`**`FOLDER_ID`**

> **Note:** n8n will auto-create monthly subfolders if you add a "Create Folder" node, or you can pre-create them monthly.

---

## Step 3: n8n Setup

### 3a. Connect Google credentials in n8n
1. In n8n → **Credentials** → **Add Credential**
2. Add **Google Drive OAuth2** — follow the OAuth flow
3. Add **Google Sheets OAuth2** — follow the OAuth flow
4. Add **OpenAI API** — paste your OpenAI API key

### 3b. Import Workflow 1 (Submission)
1. In n8n → **Workflows** → **Import from file**
2. Import `n8n_oil_submission_workflow.json`
3. Update these in the workflow:
   - **Upload to Google Drive** node → set your credential + set Parent Folder ID to your `OIL Evidence` folder ID
   - **Append Row to Google Sheet** node → set your credential + set Sheet ID (from Step 1)
4. **Activate** the workflow
5. Copy the **Webhook URL** (shown in the Webhook node) — it will look like:
   `https://YOUR_N8N_INSTANCE/webhook/oil-submit`

### 3c. Import Workflow 2 (AI Query)
1. Import `n8n_oil_query_workflow.json`
2. Update:
   - **Read Google Sheet** node → set your credential + Sheet ID
   - **ChatGPT** node → set your OpenAI credential
3. **Activate** the workflow
4. Copy the webhook URL:
   `https://YOUR_N8N_INSTANCE/webhook/oil-query`

---

## Step 4: Configure the Server

```bash
# Copy the example env file
cp .env.example .env
```

Edit `.env`:
```
N8N_SUBMISSION_WEBHOOK=https://YOUR_N8N_INSTANCE/webhook/oil-submit
N8N_QUERY_WEBHOOK=https://YOUR_N8N_INSTANCE/webhook/oil-query
PORT=3000
```

---

## Step 5: Run Locally

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or for development with auto-restart
npm run dev
```

Open:
- **Staff form:** http://localhost:3000/
- **Management chatbot:** http://localhost:3000/chat.html
- **Health check:** http://localhost:3000/health

---

## Step 6: Deploy to Render

1. Push this project to a GitHub repository
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Add **Environment Variables** in Render dashboard:
   - `N8N_SUBMISSION_WEBHOOK` = your n8n webhook URL
   - `N8N_QUERY_WEBHOOK` = your n8n query webhook URL
6. Deploy — Render gives you a public URL like `https://oil-tracker.onrender.com`

---

## How It Works (Data Flow)

```
Staff → Form (Render) → Express /submit
                           ↓
                   n8n Webhook (Workflow 1)
                      ↓         ↓
              Validate       Validate
              Fields         File Type
                         ↓
                   Upload to Google Drive
                   (OIL Evidence/YYYY-MM/StaffName_Date_Hours_Approval.pdf)
                         ↓
                   Append row to Google Sheet
                         ↓
                   ✅ Success response

Manager → Chat UI → Express /query
                       ↓
               n8n Webhook (Workflow 2)
                       ↓
               Read Google Sheet (all rows)
                       ↓
               Format as table → ChatGPT
                       ↓
               "Alice has 7.5 total OIL hours (3 approved submissions)"
```

---

## Example Chatbot Queries

| Question | What AI Returns |
|---|---|
| "How many OIL hours does Alice have?" | Total approved OIL hours for Alice |
| "Show OIL summary for February 2026" | Table grouped by staff with totals |
| "List all pending submissions" | All rows where Validation Status = Pending |
| "Who has the most OIL hours this month?" | Staff ranked by OIL hours |

---

## Marking Submissions as Approved

In the Google Sheet:
- Change **Validation Status** from `Pending` → `Approved` (or `Rejected`)
- The AI chatbot will only count `Approved` entries by default in total calculations

---

## File Naming Convention (Google Drive)

```
{StaffName}_{DateApplied}_{OILHours}h_Approval.{ext}
```

**Example:** `Alice_Tan_2026-02-15_2p5h_Approval.pdf`

*(decimal points in hours are replaced with `p`, so 2.5 → 2p5)*
