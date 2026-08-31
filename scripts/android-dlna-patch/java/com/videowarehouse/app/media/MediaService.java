package com.videowarehouse.app.media;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import android.view.KeyEvent;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import com.videowarehouse.app.R;

/**
 * 后台媒体前台服务（P3）：App 切后台时保持音频不中断 + 锁屏媒体控制。
 *
 * 设计要点：
 * - 仅 Android App（WebView 后台会被系统暂停媒体）需要此服务；Web 端靠浏览器默认行为 + P1 MediaSession。
 * - 用 {@link MediaPlayer} 直播 URL（与 WebView 的 video 元素解耦，避免 WebView 后台限制）。
 * - MediaSessionCompat（androidx）兼容 API 22+，锁屏卡片 + 耳机键 play/pause/seek。
 * - 前台通知：API 34 需声明 foregroundServiceType=specialUse + 对应权限。
 *
 * 启停由 MediaBridgePlugin 驱动：startForegroundService → start(metadata) → play/pause/seek → stop。
 */
public class MediaService extends Service {
    private static final String TAG = "MediaService";
    private static final String CHANNEL_ID = "kinotv_background_media";
    private static final int NOTIFICATION_ID = 1001;

    private static final String ACTION_START = "com.videowarehouse.app.media.START";
    private static final String ACTION_PLAY = "com.videowarehouse.app.media.PLAY";
    private static final String ACTION_PAUSE = "com.videowarehouse.app.media.PAUSE";
    private static final String ACTION_STOP = "com.videowarehouse.app.media.STOP";
    private static final String ACTION_SEEK = "com.videowarehouse.app.media.SEEK";
    private static final String EXTRA_URL = "url";
    private static final String EXTRA_TITLE = "title";
    private static final String EXTRA_ARTIST = "artist";
    private static final String EXTRA_SEEK_MS = "seekMs";

    private MediaPlayer mediaPlayer;
    private MediaSessionCompat mediaSession;
    private String currentUrl;
    private String currentTitle = "";
    private String currentArtist = "";
    private boolean isPrepared = false;

    public static Intent buildStartIntent(Context ctx, String url, String title, String artist) {
        Intent i = new Intent(ctx, MediaService.class);
        i.setAction(ACTION_START);
        i.putExtra(EXTRA_URL, url);
        i.putExtra(EXTRA_TITLE, title == null ? "" : title);
        i.putExtra(EXTRA_ARTIST, artist == null ? "" : artist);
        return i;
    }

    public static Intent buildPlayIntent(Context ctx) {
        return new Intent(ctx, MediaService.class).setAction(ACTION_PLAY);
    }

    public static Intent buildPauseIntent(Context ctx) {
        return new Intent(ctx, MediaService.class).setAction(ACTION_PAUSE);
    }

    public static Intent buildStopIntent(Context ctx) {
        return new Intent(ctx, MediaService.class).setAction(ACTION_STOP);
    }

    public static Intent buildSeekIntent(Context ctx, long positionMs) {
        return new Intent(ctx, MediaService.class)
                .setAction(ACTION_SEEK)
                .putExtra(EXTRA_SEEK_MS, positionMs);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // 不允许绑定
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
        // 用 STREAM_MUSIC 通道，与 WebView video 一致，避免与通话等冲突
        mediaSession = new MediaSessionCompat(this, TAG);
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS
                | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() { play(); }
            @Override
            public void onPause() { pause(); }
            @Override
            public void onStop() { stop(); }
            @Override
            public void onSeekTo(long pos) { seekTo(pos); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return START_NOT_STICKY;
        }
        switch (intent.getAction()) {
            case ACTION_START:
                String url = intent.getStringExtra(EXTRA_URL);
                currentTitle = intent.getStringExtra(EXTRA_TITLE);
                currentArtist = intent.getStringExtra(EXTRA_ARTIST);
                startForegroundWithNotification();
                prepareAndPlay(url);
                break;
            case ACTION_PLAY:
                play();
                break;
            case ACTION_PAUSE:
                pause();
                break;
            case ACTION_SEEK:
                long ms = intent.getLongExtra(EXTRA_SEEK_MS, 0);
                seekTo(ms);
                break;
            case ACTION_STOP:
                stop();
                break;
        }
        return START_NOT_STICKY;
    }

    private void prepareAndPlay(String url) {
        if (url == null || url.isEmpty()) {
            Log.w(TAG, "prepareAndPlay: url 为空");
            return;
        }
        // 同一 URL 已准备且未释放 → 直接 play
        if (mediaPlayer != null && isPrepared && url.equals(currentUrl)) {
            play();
            return;
        }
        releasePlayer();
        currentUrl = url;
        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_MUSIC);
            mediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
                            .build());
            mediaPlayer.setDataSource(url);
            mediaPlayer.setOnPreparedListener(mp -> {
                isPrepared = true;
                updateMetadata();
                mp.start();
                setPlaybackState(PlaybackStateCompat.STATE_PLAYING);
                updateNotification();
            });
            mediaPlayer.setOnCompletionListener(mp -> {
                setPlaybackState(PlaybackStateCompat.STATE_STOPPED);
                updateNotification();
            });
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.w(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
                isPrepared = false;
                setPlaybackState(PlaybackStateCompat.STATE_ERROR);
                return false;
            });
            mediaPlayer.prepareAsync();
        } catch (Exception e) {
            Log.e(TAG, "prepareAndPlay 失败", e);
            isPrepared = false;
        }
    }

    private void play() {
        if (mediaPlayer != null && isPrepared && !mediaPlayer.isPlaying()) {
            mediaPlayer.start();
            setPlaybackState(PlaybackStateCompat.STATE_PLAYING);
            updateNotification();
        }
    }

    private void pause() {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            setPlaybackState(PlaybackStateCompat.STATE_PAUSED);
            updateNotification();
        }
    }

    private void seekTo(long positionMs) {
        if (mediaPlayer != null && isPrepared) {
            mediaPlayer.seekTo((int) positionMs);
        }
    }

    private void stop() {
        if (mediaPlayer != null) {
            mediaPlayer.stop();
        }
        releasePlayer();
        setPlaybackState(PlaybackStateCompat.STATE_STOPPED);
        stopForeground(true);
        stopSelf();
    }

    private void releasePlayer() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {
            }
            mediaPlayer = null;
        }
        isPrepared = false;
    }

    private void updateMetadata() {
        MediaMetadataCompat.Builder mb = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "KinoTV");
        if (mediaPlayer != null && isPrepared) {
            long dur = mediaPlayer.getDuration();
            if (dur > 0) {
                mb.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, dur);
            }
        }
        mediaSession.setMetadata(mb.build());
    }

    private void setPlaybackState(int state) {
        long pos = (mediaPlayer != null && isPrepared) ? mediaPlayer.getCurrentPosition() : 0;
        PlaybackStateCompat.Builder b = new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                        | PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_SEEK_TO)
                .setState(state, pos, 1.0f);
        mediaSession.setPlaybackState(b.build());
    }

    private void startForegroundWithNotification() {
        Notification n = buildNotification(PlaybackStateCompat.STATE_PLAYING);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // API 34+ 需显式声明 foregroundServiceType + specialUse 权限
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
    }

    private Notification buildNotification(int state) {
        boolean playing = state == PlaybackStateCompat.STATE_PLAYING;
        // PendingIntent 打开 App（MainActivity）
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(this, 0, openIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setContentIntent(openPi)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        // 锁屏媒体控制：MediaStyle 绑定 MediaSession
        new MediaStyle(mediaSession).setShowActionsInCompactView(0, 1, 2);
        return builder.build();
    }

    @SuppressWarnings("deprecation")
    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            int state = (mediaPlayer != null && mediaPlayer.isPlaying())
                    ? PlaybackStateCompat.STATE_PLAYING
                    : (isPrepared ? PlaybackStateCompat.STATE_PAUSED : PlaybackStateCompat.STATE_BUFFERING);
            nm.notify(NOTIFICATION_ID, buildNotification(state));
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "后台媒体播放", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("App 切后台时保持音频播放");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(ch);
            }
        }
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 用户从最近任务列表划掉 App → 停止服务
        stop();
        super.onTaskRemoved(rootIntent);
    }
}
