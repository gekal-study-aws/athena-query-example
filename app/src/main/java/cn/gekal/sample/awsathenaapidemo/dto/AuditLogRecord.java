package cn.gekal.sample.awsathenaapidemo.dto;

import java.util.Map;

public class AuditLogRecord {
  private String year;
  private String month;
  private String day;
  private String userId;
  private String eventName;
  private String resourceId;
  private String ipAddress;
  private String timestamp;
  private String status;

  private Map<String, String> otherDetails;

  public String getYear() {
    return year;
  }

  public void setYear(String year) {
    this.year = year;
  }

  public String getMonth() {
    return month;
  }

  public void setMonth(String month) {
    this.month = month;
  }

  public String getDay() {
    return day;
  }

  public void setDay(String day) {
    this.day = day;
  }

  public String getUserId() {
    return userId;
  }

  public void setUserId(String userId) {
    this.userId = userId;
  }

  public String getEventName() {
    return eventName;
  }

  public void setEventName(String eventName) {
    this.eventName = eventName;
  }

  public String getResourceId() {
    return resourceId;
  }

  public void setResourceId(String resourceId) {
    this.resourceId = resourceId;
  }

  public String getIpAddress() {
    return ipAddress;
  }

  public void setIpAddress(String ipAddress) {
    this.ipAddress = ipAddress;
  }

  public String getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(String timestamp) {
    this.timestamp = timestamp;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public Map<String, String> getOtherDetails() {
    return otherDetails;
  }

  public void setOtherDetails(Map<String, String> otherDetails) {
    this.otherDetails = otherDetails;
  }
}
