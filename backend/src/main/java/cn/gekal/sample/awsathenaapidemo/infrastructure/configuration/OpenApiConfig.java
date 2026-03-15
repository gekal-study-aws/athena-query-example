package cn.gekal.sample.awsathenaapidemo.infrastructure.configuration;

import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import java.util.HashMap;
import java.util.Map;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnClass(OpenApiCustomizer.class)
public class OpenApiConfig {

  @Value("${aws.apigateway.vpc-link-id}")
  private String vpcLinkId;

  @Value("${aws.apigateway.alb-uri}")
  private String albUri;

  @Bean
  public OpenApiCustomizer albIntegrationCustomizer() {
    return openApi -> {
      if (openApi.getPaths() != null) {
        openApi
            .getPaths()
            .forEach(
                (path, pathItem) -> {
                  pathItem
                      .readOperations()
                      .forEach(
                          operation -> {
                            Map<String, Object> integration = new HashMap<>();
                            integration.put("type", "http_proxy");

                            integration.put("connectionType", "VPC_LINK");
                            integration.put("connectionId", vpcLinkId);
                            integration.put("httpMethod", "ANY");
                            integration.put("uri", albUri + path);
                            integration.put("passthroughBehavior", "when_no_match");

                            operation.addExtension("x-amazon-apigateway-integration", integration);
                          });

                  if (pathItem.getOptions() == null) {
                    Operation optionsOperation = new Operation();
                    optionsOperation.setSummary("CORS Preflight");
                    optionsOperation.setDescription("API GatewayによるCORSプレフライトリクエストの自動応答");

                    // ==========================================
                    // ここを追加！ Swagger UIで「CORS」というタブにまとめます
                    // ==========================================
                    optionsOperation.addTagsItem("CORS");

                    ApiResponses responses = new ApiResponses();
                    responses.addApiResponse(
                        "200", new ApiResponse().description("CORS Preflight Success"));
                    optionsOperation.setResponses(responses);

                    Map<String, Object> integration = new HashMap<>();
                    integration.put("type", "mock");

                    Map<String, String> requestTemplates = new HashMap<>();
                    requestTemplates.put("application/json", "{\"statusCode\": 200}");
                    integration.put("requestTemplates", requestTemplates);

                    Map<String, Object> responsesMap = new HashMap<>();
                    Map<String, Object> defaultResponse = new HashMap<>();
                    defaultResponse.put("statusCode", "200");

                    Map<String, String> responseParameters = new HashMap<>();
                    responseParameters.put(
                        "method.response.header.Access-Control-Allow-Origin", "'*'");
                    responseParameters.put(
                        "method.response.header.Access-Control-Allow-Methods",
                        "'GET,POST,PUT,DELETE,OPTIONS'");
                    responseParameters.put(
                        "method.response.header.Access-Control-Allow-Headers",
                        "'Content-Type,Authorization,X-Api-Key'");

                    defaultResponse.put("responseParameters", responseParameters);
                    responsesMap.put("default", defaultResponse);
                    integration.put("responses", responsesMap);

                    optionsOperation.addExtension("x-amazon-apigateway-integration", integration);
                    pathItem.setOptions(optionsOperation);
                  }
                });
      }
    };
  }
}
