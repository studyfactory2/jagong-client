import { http } from "./http";
import type { CurrentPolicy, PolicyDocument, PolicyKey } from "../../lib/types";

/** PUBLIC POLICY API **/

let currentPolicyRequest: Promise<CurrentPolicy> | null = null;

export async function getCurrentPolicy(): Promise<CurrentPolicy> {
  if (!currentPolicyRequest) {
    currentPolicyRequest = http
      .get<CurrentPolicy>("/policies/current")
      .then(({ data }) => data)
      .catch((error) => {
        currentPolicyRequest = null;
        throw error;
      });
  }

  return await currentPolicyRequest;
}

export async function getCurrentPolicyVersion(): Promise<string> {
  const policy = await getCurrentPolicy();
  return policy.version;
}

export async function getPolicyDocument(
  key: PolicyKey,
): Promise<PolicyDocument> {
  const { data } = await http.get<PolicyDocument>("/policies/" + key);
  return data;
}
