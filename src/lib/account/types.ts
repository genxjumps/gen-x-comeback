export type CustomerAccount = {
  id: string;
  email: string;
  firstName: string | null;
  linkedLeadPlans: number;
};

export type CustomerAccountResult =
  | { ok: true; account: CustomerAccount; replayed: boolean }
  | { ok: false };
