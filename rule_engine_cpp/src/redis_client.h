#ifndef AGV_RULE_ENGINE_SRC_REDIS_CLIENT_H_
#define AGV_RULE_ENGINE_SRC_REDIS_CLIENT_H_

#include "hiredis.h"
#include <string>

class RedisClient {
public:
  RedisClient(const std::string &host, int port);
  ~RedisClient();

  bool Connect();
  void Disconnect();

  // Blocking pop from list. Returns payload or empty string on timeout/error.
  std::string Blpop(const std::string &key, int timeout_sec);

  // Publish message to channel.
  void Publish(const std::string &channel, const std::string &message);

private:
  std::string host_;
  int port_;
  redisContext *context_;
};

#endif // AGV_RULE_ENGINE_SRC_REDIS_CLIENT_H_
