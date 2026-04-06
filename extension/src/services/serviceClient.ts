type PairingResponse = {
  payload: string;
  baseUrl: string;
  devices: number;
};

export async function getPairing(serviceUrl: string): Promise<PairingResponse> {
  const response = await fetch(`${serviceUrl}/pairing`);
  if (!response.ok) {
    throw new Error(`GET /pairing failed (${response.status})`);
  }
  return (await response.json()) as PairingResponse;
}

export async function checkCdpViaService(serviceUrl: string): Promise<string> {
  const response = await fetch(`${serviceUrl}/commands/check-cdp`, {
    method: "POST"
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`POST /commands/check-cdp failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as { ok: boolean; result?: string };
  if (!data.ok || !data.result) {
    throw new Error("Service did not return a CDP result.");
  }
  return data.result;
}

export async function sendTestPushViaService(serviceUrl: string, body?: string): Promise<{ sent: number; failed: number }> {
  const response = await fetch(`${serviceUrl}/commands/send-test-push`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ body })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST /commands/send-test-push failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as {
    ok: boolean;
    sent?: number;
    failed?: number;
  };
  return {
    sent: data.sent ?? 0,
    failed: data.failed ?? 0
  };
}

export async function checkServiceHealth(serviceUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${serviceUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
