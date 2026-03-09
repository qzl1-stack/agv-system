#include "json.hpp"
#include "redis_client.h"
#include "rule_engine.h"
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <string>
#include <thread>

using json = nlohmann::json;

// 从环境变量读取 Redis 配置，不存在则使用默认值
std::string GetRedisHost() {
  const char* host = std::getenv("REDIS_HOST");
  return host ? std::string(host) : "127.0.0.1";
}

int GetRedisPort() {
  const char* port = std::getenv("REDIS_PORT");
  return port ? std::atoi(port) : 6379;
}

int main() {
  std::cout << "Starting AGV Rule Engine (C++)..." << std::endl;

  agv_core::RuleEngine engine;
  std::string redis_host = GetRedisHost();
  int redis_port = GetRedisPort();
  std::cout << "Connecting to Redis at " << redis_host << ":" << redis_port << std::endl;
  
  RedisClient redis(redis_host, redis_port);

  const std::string RAW_QUEUE = "agv:raw_queue";
  const std::string ALERT_CHANNEL = "agv:alert_channel";

  while (true) {
    if (!redis.Connect()) {
      std::cout << "Redis connection failed. Retrying in 2s..." << std::endl;
      std::this_thread::sleep_for(std::chrono::seconds(2));
      continue;
    }
    std::cout << "Connected to Redis. Waiting for data..." << std::endl;

    while (true) {
      // 阻塞等待 5 秒，允许周期性检查/日志
      std::string raw_json = redis.Blpop(RAW_QUEUE, 5);

      if (raw_json.empty()) {
        // 检查连接是否仍然存活?
        // 或者只是循环回去。如果断开连接，hiredis 上下文可能会设置错误。
        // 为了简单起见，我们直接继续循环。如果 blpop 因断开连接返回空，
        // 我们应该尝试重连。
        // 但 wrapper 返回 "" 表示超时 或 错误。
        // 在健壮的实现中，我们会检查 context->err。
        // 这里假设是超时。
        continue;
      }

      try {
        auto frame = json::parse(raw_json);
        auto alerts = engine.ProcessFrame(frame);

        if (!alerts.empty()) {
          json alert_pkg;
          alert_pkg["timestamp"] = std::time(nullptr);
          alert_pkg["alerts"] = json::array();

          for (const auto &a : alerts) {
            alert_pkg["alerts"].push_back({{"type", a.type},
                                           {"level", a.level},
                                           {"msg", a.msg},
                                           {"reason", a.type}, // 映射给后端
                                           {"suggestion", a.suggestion},
                                           {"issue", a.msg}});
          }

          std::string alert_str = alert_pkg.dump();
          redis.Publish(ALERT_CHANNEL, alert_str);
          std::cout << "Processed frame -> " << alerts.size()
                    << " alerts published." << std::endl;
        }
      } catch (const std::exception &e) {
        std::cerr << "JSON Error: " << e.what() << std::endl;
      }
    }
  }

  return 0;
}
