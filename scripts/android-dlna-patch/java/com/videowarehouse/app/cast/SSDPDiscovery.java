package com.videowarehouse.app.cast;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Log;

import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.InputStream;
import java.net.DatagramPacket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * SSDP 设备发现：发送 M-SEARCH 探测局域网内 DLNA MediaRenderer 设备，
 * 并解析每个设备的 UPnP device description，提取 friendlyName 与 AVTransport / RenderingControl 服务。
 *
 * 内置总体超时（由调用方传入，建议约 3s），保证 discover() 不会无限挂起。
 */
public final class SSDPDiscovery {

    private static final String TAG = "CastSSDP";

    private static final String SSDP_ADDR = "239.255.255.250";
    private static final int SSDP_PORT = 1900;
    private static final int RECEIVE_SO_TIMEOUT_MS = 400;
    private static final int DESCRIPTION_TIMEOUT_MS = 2000;
    private static final int MAX_LOCATIONS = 32;

    private static final String ST_MEDIA_RENDERER = "urn:schemas-upnp-org:device:MediaRenderer:1";
    private static final String ST_ALL = "ssdp:all";
    private static final String SERVICE_AV_TRANSPORT = "urn:schemas-upnp-org:service:AVTransport:1";
    private static final String SERVICE_RENDERING_CONTROL = "urn:schemas-upnp-org:service:RenderingControl:1";

    private SSDPDiscovery() {
    }

    /**
     * 在 timeoutMs 内发现局域网 DLNA 播放设备（必须含 AVTransport 服务）。
     */
    public static List<CastDeviceInfo> discover(Context context, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;

        // SSDP USN -> LOCATION 去重表
        Map<String, String> locationsByUsn = new LinkedHashMap<>();

        WifiManager.MulticastLock lock = acquireMulticastLock(context);
        MulticastSocket socket = null;
        try {
            InetAddress group = InetAddress.getByName(SSDP_ADDR);
            socket = new MulticastSocket(null);
            socket.setReuseAddress(true);
            // 临时端口绑定：M-SEARCH 响应为单播回源端口，无需占用 1900
            socket.bind(new InetSocketAddress(0));
            socket.setSoTimeout(RECEIVE_SO_TIMEOUT_MS);
            trySetNetworkInterface(socket);
            socket.joinGroup(group);

            sendSearch(socket, group, ST_MEDIA_RENDERER);
            sendSearch(socket, group, ST_ALL);

            byte[] buf = new byte[4096];
            while (System.currentTimeMillis() < deadline) {
                try {
                    DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                    socket.receive(pkt);
                    String data = new String(pkt.getData(), 0, pkt.getLength(), StandardCharsets.UTF_8);
                    parseSsdpResponse(data, locationsByUsn);
                } catch (SocketTimeoutException e) {
                    // 无包，继续等
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "SSDP discover error: " + e.getMessage());
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {
                }
            }
            releaseMulticastLock(lock);
        }

        return fetchDescriptions(locationsByUsn, deadline);
    }

    private static WifiManager.MulticastLock acquireMulticastLock(Context context) {
        try {
            WifiManager wifi = (WifiManager) context.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            if (wifi == null) {
                return null;
            }
            WifiManager.MulticastLock lock = wifi.createMulticastLock("kinotv-dlna");
            lock.setReferenceCounted(false);
            lock.acquire();
            return lock;
        } catch (Exception e) {
            Log.w(TAG, "MulticastLock acquire failed: " + e.getMessage());
            return null;
        }
    }

    private static void releaseMulticastLock(WifiManager.MulticastLock lock) {
        if (lock != null) {
            try {
                lock.release();
            } catch (Exception ignored) {
            }
        }
    }

    /** 尝试把 socket 绑定到无线网卡接口（不设置的话很多设备收不到组播）。 */
    private static void trySetNetworkInterface(MulticastSocket socket) {
        try {
            NetworkInterface nif = findWlanInterface();
            if (nif != null) {
                socket.setNetworkInterface(nif);
                Log.d(TAG, "set network interface: " + nif.getName());
            }
        } catch (Exception e) {
            Log.w(TAG, "setNetworkInterface failed: " + e.getMessage());
        }
    }

    private static NetworkInterface findWlanInterface() {
        try {
            Enumeration<NetworkInterface> nifs = NetworkInterface.getNetworkInterfaces();
            if (nifs == null) {
                return null;
            }
            List<NetworkInterface> candidates = new ArrayList<>();
            for (NetworkInterface nif : Collections.list(nifs)) {
                if (!nif.isUp() || nif.isLoopback()) {
                    continue;
                }
                if (!hasIpv4(nif)) {
                    continue;
                }
                String name = nif.getName().toLowerCase(Locale.US);
                if (name.startsWith("wlan")) {
                    candidates.add(0, nif);
                } else {
                    candidates.add(nif);
                }
            }
            return candidates.isEmpty() ? null : candidates.get(0);
        } catch (Exception e) {
            Log.w(TAG, "findWlanInterface failed: " + e.getMessage());
            return null;
        }
    }

    private static boolean hasIpv4(NetworkInterface nif) {
        Enumeration<InetAddress> addrs = nif.getInetAddresses();
        while (addrs.hasMoreElements()) {
            if (addrs.nextElement() instanceof java.net.Inet4Address) {
                return true;
            }
        }
        return false;
    }

    private static void sendSearch(MulticastSocket socket, InetAddress group, String st) {
        try {
            String req = "M-SEARCH * HTTP/1.1\r\n"
                    + "HOST: " + SSDP_ADDR + ":" + SSDP_PORT + "\r\n"
                    + "MAN: \"ssdp:discover\"\r\n"
                    + "MX: 2\r\n"
                    + "ST: " + st + "\r\n"
                    + "\r\n";
            byte[] data = req.getBytes(StandardCharsets.UTF_8);
            DatagramPacket pkt = new DatagramPacket(data, data.length, group, SSDP_PORT);
            socket.send(pkt);
        } catch (Exception e) {
            Log.w(TAG, "sendSearch failed: " + e.getMessage());
        }
    }

    /** 解析 SSDP 200 OK 响应，提取 USN -> LOCATION。 */
    private static void parseSsdpResponse(String response, Map<String, String> locationsByUsn) {
        String usn = null;
        String location = null;
        String[] lines = response.split("\r?\n");
        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                continue;
            }
            int colon = line.indexOf(':');
            if (colon <= 0) {
                continue;
            }
            String key = line.substring(0, colon).trim().toUpperCase(Locale.US);
            String value = line.substring(colon + 1).trim();
            if ("USN".equals(key)) {
                usn = value;
            } else if ("LOCATION".equals(key)) {
                location = value;
            }
        }
        if (usn == null || usn.isEmpty() || location == null || location.isEmpty()) {
            return;
        }
        if (!locationsByUsn.containsKey(usn)) {
            if (locationsByUsn.size() >= MAX_LOCATIONS) {
                return;
            }
            locationsByUsn.put(usn, location);
        }
    }

    /** 逐个拉取 device description，过滤出含 AVTransport 服务的设备。 */
    private static List<CastDeviceInfo> fetchDescriptions(Map<String, String> locationsByUsn, long deadline) {
        List<CastDeviceInfo> result = new ArrayList<>();
        for (Map.Entry<String, String> entry : locationsByUsn.entrySet()) {
            if (System.currentTimeMillis() >= deadline || result.size() >= MAX_LOCATIONS) {
                break;
            }
            try {
                CastDeviceInfo dev = fetchDeviceDescription(entry.getKey(), entry.getValue(), deadline);
                if (dev != null) {
                    result.add(dev);
                }
            } catch (Exception e) {
                Log.w(TAG, "fetch description failed for " + entry.getKey() + ": " + e.getMessage());
            }
        }
        return result;
    }

    private static CastDeviceInfo fetchDeviceDescription(String usn, String location, long deadline) {
        long budget = Math.min(DESCRIPTION_TIMEOUT_MS, Math.max(500, deadline - System.currentTimeMillis()));
        if (budget <= 0) {
            return null;
        }
        java.net.HttpURLConnection conn = null;
        try {
            URL url = new URL(location);
            String host = url.getHost();
            int port = url.getPort();
            String address = port > 0 && port != 80 ? host + ":" + port : host;

            conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setConnectTimeout((int) budget);
            conn.setReadTimeout((int) budget);
            conn.setRequestProperty("Accept", "text/xml");

            Map<String, String> services;
            String friendlyName;
            try (InputStream in = conn.getInputStream()) {
                DescriptionResult parsed = parseDescription(in);
                friendlyName = parsed.friendlyName;
                services = parsed.services;
            }
            if (friendlyName == null || friendlyName.isEmpty()) {
                friendlyName = host;
            }
            String base = location.substring(0, location.lastIndexOf('/') + 1);
            String avUrl = resolveUrl(base, services.get(SERVICE_AV_TRANSPORT));
            if (avUrl == null) {
                // 无 AVTransport 服务的设备不是可投屏目标
                return null;
            }
            String volumeUrl = resolveUrl(base, services.get(SERVICE_RENDERING_CONTROL));
            String id = (usn == null || usn.isEmpty()) ? location : usn;
            return new CastDeviceInfo(id, friendlyName, address, avUrl, volumeUrl);
        } catch (Exception e) {
            Log.w(TAG, "fetch device description error: " + e.getMessage());
            return null;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static String resolveUrl(String base, String controlUrl) {
        if (controlUrl == null || controlUrl.isEmpty()) {
            return null;
        }
        if (controlUrl.startsWith("http://") || controlUrl.startsWith("https://")) {
            return controlUrl;
        }
        String clean = controlUrl.startsWith("/") ? controlUrl.substring(1) : controlUrl;
        return base + clean;
    }

    private static DescriptionResult parseDescription(InputStream in) throws Exception {
        XmlPullParserFactory factory = XmlPullParserFactory.newInstance();
        XmlPullParser parser = factory.newPullParser();
        parser.setInput(in, StandardCharsets.UTF_8.name());

        DescriptionResult result = new DescriptionResult();
        Map<String, String> services = new HashMap<>();
        result.services = services;

        int eventType = parser.getEventType();
        String currentServiceType = null;
        String currentControlUrl = null;
        boolean inDevice = false;

        while (eventType != XmlPullParser.END_DOCUMENT) {
            switch (eventType) {
                case XmlPullParser.START_TAG: {
                    String tag = parser.getName();
                    if (tag == null) {
                        break;
                    }
                    switch (tag) {
                        case "device":
                            inDevice = true;
                            break;
                        case "friendlyName":
                            if (inDevice && result.friendlyName == null) {
                                result.friendlyName = parser.nextText();
                            }
                            break;
                        case "service":
                            currentServiceType = null;
                            currentControlUrl = null;
                            break;
                        case "serviceType":
                            currentServiceType = parser.nextText();
                            break;
                        case "controlURL":
                            currentControlUrl = parser.nextText();
                            break;
                        default:
                            break;
                    }
                    break;
                }
                case XmlPullParser.END_TAG: {
                    String tag = parser.getName();
                    if ("service".equals(tag)) {
                        if (currentServiceType != null && currentControlUrl != null
                                && !currentControlUrl.isEmpty()) {
                            services.put(currentServiceType, currentControlUrl);
                        }
                        currentServiceType = null;
                        currentControlUrl = null;
                    } else if ("device".equals(tag)) {
                        inDevice = false;
                    }
                    break;
                }
                default:
                    break;
            }
            eventType = parser.next();
        }
        return result;
    }

    private static final class DescriptionResult {
        String friendlyName;
        Map<String, String> services;
    }
}
