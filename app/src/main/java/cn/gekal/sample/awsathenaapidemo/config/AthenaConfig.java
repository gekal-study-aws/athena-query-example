package cn.gekal.sample.awsathenaapidemo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.athena.AthenaClient;

@Configuration
public class AthenaConfig {

    @Bean
    public AthenaClient athenaClient() {
        return AthenaClient.builder()
                .region(Region.AP_NORTHEAST_1) // 東京リージョンの場合
                // .credentialsProvider(...) // 必要に応じて明示的に指定
                .build();
    }
}