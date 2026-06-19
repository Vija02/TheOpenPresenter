import axios from "axios";

export async function isOnline(timeoutMs = 5000): Promise<boolean> {
  try {
    await axios.head("https://view.officeapps.live.com/", {
      timeout: timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
}
