const { allowCors, sendJson, supabaseFetch, toIso } = require("./_supabase");

const activeWindowMs = 2 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const deviceId = String(req.body?.deviceId || "").trim();
    const employee = String(req.body?.employee || "").trim();
    if (!deviceId) return sendJson(res, 400, { success: false, error: "Device id wajib ada." });

    const rows = await supabaseFetch("app_settings?select=*&key=eq.active_device&limit=1");
    const active = Array.isArray(rows) ? rows[0]?.value : null;
    const lastSeenAt = active?.lastSeenAt ? new Date(active.lastSeenAt) : null;
    const otherActive =
      active?.deviceId &&
      active.deviceId !== deviceId &&
      lastSeenAt &&
      Date.now() - lastSeenAt.getTime() < activeWindowMs;

    if (req.body?.logout) {
      if (active?.deviceId === deviceId) {
        await supabaseFetch("app_settings?on_conflict=key", {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=representation",
          body: [
            {
              key: "active_device",
              value: {
                deviceId: "",
                employee: "",
                userAgent: "",
                lastSeenAt: "1970-01-01T00:00:00.000Z",
              },
              updated_at: toIso(),
            },
          ],
        });
      }

      return sendJson(res, 200, { success: true, cleared: active?.deviceId === deviceId });
    }

    if (req.body?.checkOnly) {
      return sendJson(res, 200, {
        success: true,
        otherActive: Boolean(otherActive),
        activeDevice: otherActive ? active : null,
      });
    }

    await supabaseFetch("app_settings?on_conflict=key", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: [
        {
          key: "active_device",
          value: {
            deviceId,
            employee,
            userAgent: req.headers["user-agent"] || "",
            lastSeenAt: toIso(),
          },
          updated_at: toIso(),
        },
      ],
    });

    return sendJson(res, 200, {
      success: true,
      otherActive: Boolean(otherActive),
      activeDevice: otherActive ? active : null,
    });
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message });
  }
};
