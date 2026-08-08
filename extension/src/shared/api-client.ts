import type { BackgroundRequest, BackgroundResponse } from "./contracts";

export async function sendBackground<T>(request: BackgroundRequest): Promise<BackgroundResponse<T>> {
  return chrome.runtime.sendMessage(request) as Promise<BackgroundResponse<T>>;
}

export async function openThread(threadId: string): Promise<void> {
  await sendBackground({ type: "OPEN_THREAD", payload: { threadId } });
}