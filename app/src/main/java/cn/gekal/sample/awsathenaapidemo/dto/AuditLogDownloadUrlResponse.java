package cn.gekal.sample.awsathenaapidemo.dto;

public class AuditLogDownloadUrlResponse {
    private String downloadUrl;

    public AuditLogDownloadUrlResponse(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }
}
