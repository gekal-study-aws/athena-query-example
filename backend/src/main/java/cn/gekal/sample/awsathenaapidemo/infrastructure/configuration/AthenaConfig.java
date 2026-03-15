package cn.gekal.sample.awsathenaapidemo.infrastructure.configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.ProfileCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.athena.AthenaClient;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class AthenaConfig {

  @Value("${aws.athena.region:ap-northeast-1}")
  private String region;

  @Value("${aws.profile:default}")
  private String profile;

  @Bean
  public AwsCredentialsProvider awsCredentialsProvider() {
    if (profile != null && !profile.isEmpty() && !"default".equals(profile)) {
      return ProfileCredentialsProvider.builder()
          .profileName(profile)
          .build();
    }
    return DefaultCredentialsProvider.create();
  }

  @Bean
  public AthenaClient athenaClient(AwsCredentialsProvider credentialsProvider) {
    return AthenaClient.builder()
        .region(Region.of(region))
        .credentialsProvider(credentialsProvider)
        .build();
  }

  @Bean
  public S3Presigner s3Presigner(AwsCredentialsProvider credentialsProvider) {
    return S3Presigner.builder()
        .region(Region.of(region))
        .credentialsProvider(credentialsProvider)
        .build();
  }
}
