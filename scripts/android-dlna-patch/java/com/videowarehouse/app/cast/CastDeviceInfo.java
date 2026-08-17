package com.videowarehouse.app.cast;

/**
 * DLNA 设备信息（SSDP 发现 + UPnP device description 解析结果）。
 * 字段对应前端 {@code CastDevice} 契约的 id / name / address。
 */
public final class CastDeviceInfo {
    /** 设备唯一 ID（SSDP USN） */
    public final String id;
    /** 设备显示名（friendlyName，如「客厅电视」） */
    public final String name;
    /** 设备地址（LOCATION 的 host:port） */
    public final String address;
    /** AVTransport 服务 controlURL（绝对地址，SetAVTransportURI/Play/Pause/Seek/Stop 用） */
    public final String controlUrl;
    /** RenderingControl 服务 controlURL（绝对地址，SetVolume 用；设备不支持时为 null） */
    public final String volumeControlUrl;

    public CastDeviceInfo(String id, String name, String address, String controlUrl, String volumeControlUrl) {
        this.id = id;
        this.name = name;
        this.address = address;
        this.controlUrl = controlUrl;
        this.volumeControlUrl = volumeControlUrl;
    }
}
