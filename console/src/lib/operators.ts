import type { Role } from "@/lib/session-token";

export type Operator = {
  id: string;
  role: Role;
  name: string;
};

export const OPERATORS: Operator[] = [
  { id: "analyst", role: "analyst", name: "Analyst" },
  { id: "reviewer", role: "reviewer", name: "Reviewer" },
  { id: "admin", role: "admin", name: "Administrator" },
];

export function findOperator(id: string, password: string) {
  const operator = OPERATORS.find((item) => item.id === id);
  if (!operator || process.env.NODE_ENV==="production" || process.env.ENABLE_LOCAL_OPERATORS!=="true")
    return null;
  const expected=id==="analyst"?process.env.LOCAL_ANALYST_PASSWORD:
    id==="reviewer"?process.env.LOCAL_REVIEWER_PASSWORD:process.env.LOCAL_ADMIN_PASSWORD;
  if(!expected || expected.length!==password.length)return null;
  let diff=0;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^password.charCodeAt(i);
  return diff===0?operator:null;
}

export function canReview(role: Role) {
  return role === "reviewer" || role === "admin";
}

export function canAdminister(role: Role) {
  return role === "admin";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}
