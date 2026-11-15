# Frontend Requirements & Implementation Guide: Razorpay Route & Direct Settlements

**Status:** PENDING_FRONTEND (Backend Phases 0–4 & 6 Fully Completed & Verified)  
**Last Updated:** 2026-11-15  
**Target Audience:** Frontend & Mobile Engineers working on `apps/native`.  
**Scope:** NGO Banking & Payout Onboarding, Real-time IFSC Validation, Payout Status Lifecycle, Volunteer 80G Tax Receipt Capture, and Superadmin Route & Refund Management.  
**Stack Reference:** Expo SDK 58, React 19.3.0, React Native 0.88.0, Expo Router, TanStack Query, `@nabhya/shared`, `useTheme()`.

---

## 1. Executive Summary & Status

All backend contracts, database migrations (0018 & 0019), AES-256-GCM encryption, Route `transfers` on orders, webhook state machines, and refund endpoints are **100% complete and tested** across 153 endpoints and 35 automated integration tests.

The frontend (`apps/native`) currently has **no integration** with the payout system. A frontend engineer must implement the UI components, forms, and hooks outlined in this document to complete the direct-settlement feature.

### Frontend Gap Status Matrix

| Component / Area | File Location | Status | Urgency | Description |
|---|---|---|---|---|
| **API Client & Endpoints** | `lib/api/endpoints.ts`, `services.ts`, `query-keys.ts` | `[PENDING]` | **CRITICAL** | Define `PAYOUTS` endpoints, service methods, and TanStack query keys. |
| **NGO Banking & Payout Card** | `app/(ngo)/verification.tsx` (or new tab `payouts.tsx`) | `[PENDING]` | **CRITICAL** | Form to collect Bank Account, Confirm Account, IFSC, PAN, and Signatory details. |
| **Real-Time IFSC Lookup Hook** | `hooks/use-ifsc-lookup.ts` | `[PENDING]` | **HIGH** | Query `https://ifsc.razorpay.com/:code` to auto-resolve bank name & branch. |
| **Volunteer 80G Tax Capture** | `components/donate-sheet.tsx` | `[PENDING]` | **CRITICAL** | Checkbox for 80G tax receipt + inputs for Donor PAN and residential address. |
| **Donation Gatekeeper** | `components/donate-sheet.tsx` & `app/ngos/[id].tsx` | `[PENDING]` | **CRITICAL** | Disable or hide "Donate" CTA if NGO has not reached `ACTIVATED` payout status. Wire `DonateSheet` into `ngos/[id].tsx`. |
| **Superadmin Dossier Payout Card** | `app/(admin)/organizations.tsx` | `[PENDING]` | **HIGH** | View payout status, masked account details, and "Retry Razorpay Sync" button. |
| **Superadmin Finance & Refund** | `app/(admin)/finance.tsx` | `[PENDING]` | **HIGH** | Display Route `transferStatus` (`PENDING`, `PROCESSED`, `FAILED`, `REVERSED`) and action to refund. |

---

## 2. Design System & Frontend Guidelines (Must Follow)

Read `apps/native/AGENTS.md` before writing code. Crucial rules to maintain:
- **No `Alert.alert`**: Use `toast.success`, `toast.error` from `@/components/ui/overlay` for transient feedback, or inline `Banner` for form errors.
- **Tokens**: Use `useTheme()` (`colors`, `spacing`, `borderRadius`, `typography`). Never hardcode hex values.
- **Surface**: Use `Surface` (`components/screen-shell`) with `borderRadius.xl`, `background.card`, and no borders for cards.
- **Platform Parity**: The code runs on **Android dev client** and **Expo Web**. Verify on both.
- **Copy-Paste Block**: Prevent copy-pasting into the "Confirm Account Number" field to prevent cascading typos.

---

## 3. Screen 1: NGO Payout Setup & Banking Profile

### Where It Lives
Integrate into [`apps/native/src/app/(ngo)/verification.tsx`](file:///t:/college%20projects/nabhya/apps/native/src/app/(ngo)/verification.tsx) as a dedicated stage or fourth section: **"Direct Payouts & Banking"**.

```
┌────────────────────────────────────────────────────────────────────────┐
│ DIRECT PAYOUTS & SETTLEMENTS                            [ACTIVATED]    │
│ Donations settle directly into your verified bank account.             │
├────────────────────────────────────────────────────────────────────────┤
│ Bank: HDFC Bank (Indiranagar, Bengaluru)                               │
│ Account: •••• 1098  |  IFSC: HDFC0001234                               │
│ Account Holder: Helping Hands Trust                                    │
│ NGO PAN: AAATP1234F                                                    │
├────────────────────────────────────────────────────────────────────────┤
│ [Update Bank Details]                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Component: `components/payout/payout-setup-card.tsx`
Handles two modes:

#### 1. View Mode (When already submitted or active):
- Displays masked bank details (`•••• 1098`), bank name, branch name, account holder name, and masked NGO PAN (`AAATP****F`).
- **Status Badge:**
  - `SUBMITTED`: Neutral pill (*"Banking details saved. Will be submitted for verification upon legal approval."*).
  - `UNDER_REVIEW`: Blue info pill (*"Razorpay is verifying your bank account via penny-drop. Usually 24–48 hours."*).
  - `ACTIVATED`: Green success pill (*"Active — Donations settle directly to your account"*).
  - `NEEDS_CLARIFICATION`: Orange warning banner with the exact reason returned by Razorpay (*"Name mismatch on bank account"* or *"Cheque illegible"*), plus an **[Update Details]** button.
  - `REJECTED`: Red error banner.

#### 2. Edit / Setup Form Mode:
Collects all required fields grouped into clean sections (validated against `createPayoutProfileSchema` from `@nabhya/shared`):

* **Section A: Legal Entity & Tax**
  * `legalEntityName`: Full registered trust/society/section-8 name.
  * `businessType`: ChoiceChips (`trust`, `society`, `section8`, `ngo`).
  * `pan`: 10 characters, auto-capitalised (`autoCapitalize="characters"`), regex `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`.

* **Section B: Bank Account Details**
  * `accountHolderName`: Exact name on the bank account.
  * `bankAccountNumber`: Numeric input (`keyboardType="number-pad"`).
  * `confirmBankAccountNumber`: Must match `bankAccountNumber`. Disable context menu / paste:
    ```tsx
    <Input
      keyboardType="number-pad"
      contextMenuHidden={true}
      selectTextOnFocus={false}
      placeholder="Re-enter bank account number"
    />
    ```
  * `ifsc`: 11 characters (`autoCapitalize="characters"`).
    * When 11 characters are entered, trigger `useIfscLookup(ifsc)`.
    * Display resolved bank banner showing `{bank} — {branch}` with a green checkmark icon.

* **Section C: Authorised Signatory / Primary Trustee (Mandatory for Razorpay KYC)**
  * `signatoryName`: Full Name.
  * `signatoryEmail`: Email.
  * `signatoryPhone`: 10-digit mobile number.
  * `signatoryDob`: Date format `YYYY-MM-DD`. Must be 18+.
  * `signatoryPan`: Personal PAN of the signatory.
  * `signatoryAddress`: Residential address.

---

## 4. Screen 2: Volunteer Donate Sheet & 80G Tax Exemption

### Where It Lives
[`apps/native/src/components/donate-sheet.tsx`](file:///t:/college%20projects/nabhya/apps/native/src/components/donate-sheet.tsx) and wired into [`apps/native/src/app/ngos/[id].tsx`](file:///t:/college%20projects/nabhya/apps/native/src/app/ngos/[id].tsx).

### 1. Gatekeeper on Payout Status
Before allowing donation entry, check whether the NGO can accept direct payments:
```tsx
const canReceiveDonations = organization.payoutStatus === "ACTIVATED";

if (!canReceiveDonations) {
  return (
    <View style={styles.blockedContainer}>
      <ShieldAlert size={28} color={colors.warning.main} />
      <Body style={{ marginTop: spacing[3], textAlign: "center" }}>
        This organisation is currently completing direct bank verification and cannot accept online donations yet.
      </Body>
      <Button variant="secondary" label="Close" onPress={onClose} style={{ marginTop: spacing[4] }} />
    </View>
  );
}
```

### 2. 80G Tax Exemption Opt-In
Indian Income Tax Form 10BD requires capturing Donor PAN and Address for 80G tax deductions. Add an expandable checkbox section above the Donate button:

```tsx
<Pressable
  onPress={() => setWants80G(!wants80G)}
  style={styles.checkboxRow}
  accessibilityRole="checkbox"
  accessibilityState={{ checked: wants80G }}
>
  <Tick checked={wants80G} />
  <View style={{ marginLeft: spacing[2], flex: 1 }}>
    <Label>I want an 80G Tax Exemption Receipt</Label>
    <Caption color="tertiary">Requires PAN and address under Indian IT Form 10BD</Caption>
  </View>
</Pressable>

{wants80G && (
  <View style={styles.taxFieldsContainer}>
    <Field label="Donor PAN" error={panError}>
      <Input
        value={donorPan}
        onChangeText={(t) => setDonorPan(t.toUpperCase())}
        placeholder="ABCDE1234F"
        autoCapitalize="characters"
        maxLength={10}
      />
    </Field>
    
    <Field label="Residential Address" error={addressError}>
      <Input
        value={donorAddress}
        onChangeText={setDonorAddress}
        placeholder="House/Street, City, State, PIN"
        multiline
      />
    </Field>
  </View>
)}
```

Pass `wants80G`, `donorPan`, and `donorAddress` into the `donate.mutate()` checkout payload.

---

## 5. Screen 3: Superadmin Console Updates

### 1. NGO Dossier (`apps/native/src/app/(admin)/organizations.tsx`)
Add a **"Direct Settlement & Payouts"** panel inside the organization review dossier:
- **Linked Account ID:** Displays `acc_xxxx` with a copy button.
- **Settlement Status:** Status pill (`ACTIVATED`, `UNDER_REVIEW`, `NEEDS_CLARIFICATION`, `REJECTED`, `SUBMITTED`).
- **Bank Details:** Masked account number (`•••• 1098`), IFSC, and Holder Name.
- **Manual Retry Action:** If Razorpay account onboarding failed:
  ```tsx
  <Button
    label="Retry Razorpay Sync"
    variant="secondary"
    loading={retrySync.isPending}
    onPress={() => retrySync.mutate(org.id)}
  />
  ```

### 2. Finance Ledger (`apps/native/src/app/(admin)/finance.tsx`)
In the donation table / card list, add:
- **Transfer Status Column:**
  - `PROCESSED`: Green pill (settled directly to NGO).
  - `FAILED`: Red pill (payment received, but transfer to NGO bank failed).
  - `PENDING`: Yellow pill.
  - `REVERSED`: Neutral pill (refunded/clawed back).
- **Refund Action Button:**
  - Calls `POST /api/admin/donations/:id/refund` via `useRefundDonation()`.
  - Reverses the Route transfer from the NGO's account and updates ledger.

---

## 6. API Layer & React Hooks Code Templates

### 1. API Endpoints: `apps/native/src/lib/api/endpoints.ts`
Add to `endpoints.ts`:
```typescript
export const PAYOUTS = {
  MINE: "/org/payout",
  SUBMIT: "/org/payout",
  ADMIN_GET: (id: string) => `/admin/organizations/${id}/payout`,
  ADMIN_RETRY_SYNC: (id: string) => `/admin/organizations/${id}/payout/retry-sync`,
  ADMIN_REFUND: (donationId: string) => `/admin/donations/${donationId}/refund`,
} as const;
```

### 2. API Service Methods: `apps/native/src/lib/api/services.ts`
```typescript
import { PAYOUTS } from "./endpoints";
import type { CreatePayoutProfileInput, PayoutProfileView } from "@nabhya/shared";

export const payoutsApi = {
  getMyPayoutProfile: async (): Promise<PayoutProfileView | null> => {
    const { data } = await api.get<{ data: PayoutProfileView | null }>(PAYOUTS.MINE);
    return data.data;
  },

  submitPayoutProfile: async (payload: CreatePayoutProfileInput): Promise<PayoutProfileView> => {
    const { data } = await api.post<{ data: PayoutProfileView }>(PAYOUTS.SUBMIT, payload);
    return data.data;
  },

  getOrgPayoutProfile: async (orgId: string): Promise<PayoutProfileView | null> => {
    const { data } = await api.get<{ data: PayoutProfileView | null }>(PAYOUTS.ADMIN_GET(orgId));
    return data.data;
  },

  retryRazorpaySync: async (orgId: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ data: { message: string } }>(PAYOUTS.ADMIN_RETRY_SYNC(orgId));
    return data.data;
  },

  refundDonation: async (donationId: string): Promise<{ message: string; refundId: string }> => {
    const { data } = await api.post<{ data: { message: string; refundId: string } }>(
      PAYOUTS.ADMIN_REFUND(donationId),
    );
    return data.data;
  },
};
```

### 3. React Query Hooks: `apps/native/src/hooks/use-payout.ts`
```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { payoutsApi } from "@/lib/api/services";
import { toast } from "@/components/ui/overlay";
import { queryScopes } from "@/lib/api/query-keys";

export function useMyPayoutProfile() {
  return useQuery({
    queryKey: ["payout", "mine"],
    queryFn: payoutsApi.getMyPayoutProfile,
  });
}

export function useSubmitPayoutProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payoutsApi.submitPayoutProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payout", "mine"] });
      toast.success("Banking details saved for verification.");
    },
    onError: () => {
      toast.error("Could not save bank details. Please check your inputs.");
    },
  });
}

export function useIfscLookup(ifsc: string) {
  const clean = ifsc.trim().toUpperCase();
  const isValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean);

  return useQuery({
    queryKey: ["ifsc", clean],
    queryFn: async () => {
      const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(clean)}`);
      if (!res.ok) return null;
      const body = await res.json();
      return { bank: body.BANK as string, branch: body.BRANCH as string, city: body.CITY as string };
    },
    enabled: isValid,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

export function useRetryRazorpaySync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payoutsApi.retryRazorpaySync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.admin });
      toast.success("Razorpay onboarding sync triggered.");
    },
    onError: () => {
      toast.error("Failed to sync with Razorpay. Check server logs.");
    },
  });
}

export function useRefundDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payoutsApi.refundDonation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.donations });
      toast.success("Donation refund processed.");
    },
    onError: () => {
      toast.error("Could not process refund.");
    },
  });
}
```

---

## 7. Acceptance Checklist for Frontend Engineers

Before marking frontend tasks complete, verify:

- [ ] **IFSC Live Lookup**: Typing `HDFC0001234` or `SBIN0000691` shows bank and branch in real time. Invalid IFSCs show an error.
- [ ] **Confirm Account Match**: Mismatched account numbers trigger inline field error and disable submission.
- [ ] **Copy-Paste Block**: Pasting into `confirmBankAccountNumber` is prevented.
- [ ] **Masked Response**: Reloading the payout screen displays only `•••• 1098` and `AAATP****F`.
- [ ] **80G Toggle & Form 10BD**: Opting into 80G requires PAN and address. Unchecking allows guest donation without PAN.
- [ ] **Donation Gatekeeper**: NGOs with `payoutStatus !== "ACTIVATED"` show a warning card in `DonateSheet` and block checkout.
- [ ] **Admin Retry & Refund**: Superadmin can trigger retry sync for stuck profiles and issue refunds that reverse Route transfers.
- [ ] **Light / Dark Mode Contrast**: All tokens obey `useTheme()`.
- [ ] **Android & Web Parity**: Form fields, toasts, and sheets function identically on Android dev client and Expo Web.
