package cn.gekal.sample.awsathenaapidemo.infrastructure.configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.athena.AthenaClient;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class AthenaConfig {

  @Value("${aws.athena.region:ap-northeast-1}")
  private String region;

  @Bean
  public AthenaClient athenaClient() {
    return AthenaClient.builder().region(Region.of(region)).build();
  }

  @Bean
  public S3Presigner s3Presigner() {
    return S3Presigner.builder().region(Region.of(region)).build();
  }
}
