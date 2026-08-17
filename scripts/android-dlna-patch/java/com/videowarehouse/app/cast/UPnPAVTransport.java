package com.videowarehouse.app.cast;

import android.util.Log;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * UPnP AVTransport / RenderingControl SOAP 客户端。
 * 负责向 DLNA 设备推送播放：SetAVTransportURI（+ 自动 Play）、Play/Pause/Stop/Seek、SetVolume。
 */
public final class UPnPAVTransport {

    private static final String TAG = "CastAVTransport";

    private static final String NS_AV = "urn:schemas-upnp-org:service:AVTransport:1";
    private static final String NS_RENDERING = "urn:schemas-upnp-org:service:RenderingControl:1";
    private static final String NS_SOAPENV = "http://schemas.xmlsoap.org/soap/envelope/";

    private static final int CONNECT_TIMEOUT_MS = 4000;
    private static final int READ_TIMEOUT_MS = 8000;

    private UPnPAVTransport() {
    }

    /**
     * SetAVTransportURI：推送当前播放 URL 至设备，随后自动 Play。
     * Play 失败不视为整体失败（部分设备需要稍后再播）。
     */
    public static void setAVTransportURI(CastDeviceInfo device, String url, String title) throws Exception {
        if (device.controlUrl == null) {
            throw new IllegalStateException("device has no AVTransport controlUrl");
        }
        String metadata = buildDidlLite(url, title);
        String body = "<u:SetAVTransportURI xmlns:u=\"" + NS_AV + "\">"
                + "<InstanceID>0</InstanceID>"
                + "<CurrentURI>" + escapeXml(url) + "</CurrentURI>"
                + "<CurrentURIMetaData>" + escapeXml(metadata) + "</CurrentURIMetaData>"
                + "</u:SetAVTransportURI>";
        sendAction(device.controlUrl, NS_AV, "SetAVTransportURI", body);
        try {
            play(device);
        } catch (Exception e) {
            Log.w(TAG, "auto Play failed (non-fatal): " + e.getMessage());
        }
    }

    public static void play(CastDeviceInfo device) throws Exception {
        if (device.controlUrl == null) {
            return;
        }
        String body = "<u:Play xmlns:u=\"" + NS_AV + "\">"
                + "<InstanceID>0</InstanceID>"
                + "<Speed>1</Speed>"
                + "</u:Play>";
        sendAction(device.controlUrl, NS_AV, "Play", body);
    }

    public static void pause(CastDeviceInfo device) throws Exception {
        if (device.controlUrl == null) {
            return;
        }
        String body = "<u:Pause xmlns:u=\"" + NS_AV + "\">"
                + "<InstanceID>0</InstanceID>"
                + "</u:Pause>";
        sendAction(device.controlUrl, NS_AV, "Pause", body);
    }

    public static void stop(CastDeviceInfo device) throws Exception {
        if (device.controlUrl == null) {
            return;
        }
        String body = "<u:Stop xmlns:u=\"" + NS_AV + "\">"
                + "<InstanceID>0</InstanceID>"
                + "</u:Stop>";
        sendAction(device.controlUrl, NS_AV, "Stop", body);
    }

    /** Seek：time 为秒，转为 REL_TIME (HH:MM:SS) 定位。 */
    public static void seek(CastDeviceInfo device, double timeSeconds) throws Exception {
        if (device.controlUrl == null) {
            return;
        }
        String target = formatRelTime(timeSeconds);
        String body = "<u:Seek xmlns:u=\"" + NS_AV + "\">"
                + "<InstanceID>0</InstanceID>"
                + "<Unit>REL_TIME</Unit>"
                + "<Target>" + target + "</Target>"
                + "</u:Seek>";
        sendAction(device.controlUrl, NS_AV, "Seek", body);
    }

    /** SetVolume：volume 为 0.0 ~ 1.0，映射为 DesiredVolume 0 ~ 100。 */
    public static void setVolume(CastDeviceInfo device, double volume) throws Exception {
        if (device.volumeControlUrl == null) {
            throw new IllegalStateException("device has no RenderingControl controlUrl");
        }
        int desired = (int) Math.max(0, Math.min(100, Math.round(volume * 100)));
        String body = "<u:SetVolume xmlns:u=\"" + NS_RENDERING + "\">"
                + "<InstanceID>0</InstanceID>"
                + "<Channel>Master</Channel>"
                + "<DesiredVolume>" + desired + "</DesiredVolume>"
                + "</u:SetVolume>";
        sendAction(device.volumeControlUrl, NS_RENDERING, "SetVolume", body);
    }

    private static void sendAction(String controlUrl, String serviceType, String action, String body) throws Exception {
        String envelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                + "<s:Envelope xmlns:s=\"" + NS_SOAPENV + "\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">"
                + "<s:Body>"
                + body
                + "</s:Body>"
                + "</s:Envelope>";

        HttpURLConnection conn = null;
        try {
            URL url = new URL(controlUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "text/xml; charset=\"utf-8\"");
            conn.setRequestProperty("SOAPAction", "\"" + serviceType + "#" + action + "\"");
            byte[] payload = envelope.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(payload.length);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload);
            }

            int code = conn.getResponseCode();
            if (code != 200) {
                throw new java.io.IOException("SOAP " + action + " failed, HTTP " + code + " from " + controlUrl);
            }
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static String buildDidlLite(String url, String title) {
        String safeTitle = (title == null || title.isEmpty()) ? "KinoTV" : title;
        return "<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\" "
                + "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" "
                + "xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\">"
                + "<item id=\"0\" parentID=\"0\" restricted=\"1\">"
                + "<dc:title>" + escapeXml(safeTitle) + "</dc:title>"
                + "<upnp:class>object.item.videoItem</upnp:class>"
                + "<res protocolInfo=\"http-get:*:*:*\">" + escapeXml(url) + "</res>"
                + "</item>"
                + "</DIDL-Lite>";
    }

    private static String formatRelTime(double seconds) {
        long total = (long) Math.max(0, seconds);
        long h = total / 3600;
        long m = (total % 3600) / 60;
        long s = total % 60;
        return String.format(java.util.Locale.US, "%02d:%02d:%02d", h, m, s);
    }

    private static String escapeXml(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
