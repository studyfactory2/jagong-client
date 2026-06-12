import { http } from "./http";

/** PUBLIC STATUS API **/

export async function getOnlineCount(): Promise<{ count: number }> {
  const { data } = await http.get<{ count: number }>("/users/online-count");
  return data;
}
