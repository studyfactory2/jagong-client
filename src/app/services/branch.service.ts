import { http } from "./http";
import type { Branch } from "../../lib/types";

/** BRANCH API **/

export async function getBranches(): Promise<Branch[]> {
  const { data } = await http.get<Branch[]>("/branches");
  return data;
}
