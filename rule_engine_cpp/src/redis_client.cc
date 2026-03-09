#include "redis_client.h"
#include <iostream>

RedisClient::RedisClient(const std::string &host, int port)
    : host_(host), port_(port), context_(nullptr) {}

RedisClient::~RedisClient() { Disconnect(); }

bool RedisClient::Connect() {
  Disconnect();                         // 确保状态清理
  struct timeval timeout = {1, 500000}; // 1.5 秒超时
  context_ = redisConnectWithTimeout(host_.c_str(), port_, timeout);
  if (context_ == nullptr || context_->err) {
    if (context_) {
      std::cerr << "Connection error: " << context_->errstr << std::endl;
      redisFree(context_);
      context_ = nullptr;
    } else {
      std::cerr << "Connection error: can't allocate redis context"
                << std::endl;
    }
    return false;
  }
  return true;
}

void RedisClient::Disconnect() {
  if (context_) {
    redisFree(context_);
    context_ = nullptr;
  }
}

std::string RedisClient::Blpop(const std::string &key, int timeout_sec) {
  if (!context_)
    return "";

  redisReply *reply = (redisReply *)redisCommand(context_, "BLPOP %s %d",
                                                 key.c_str(), timeout_sec);
  if (!reply)
    return "";

  std::string result = "";
  if (reply->type == REDIS_REPLY_ARRAY && reply->elements == 2) {
    // element[0] 是 key, element[1] 是 value
    result = reply->element[1]->str;
  }

  freeReplyObject(reply);
  return result;
}

void RedisClient::Publish(const std::string &channel,
                          const std::string &message) {
  if (!context_)
    return;

  redisReply *reply = (redisReply *)redisCommand(
      context_, "PUBLISH %s %s", channel.c_str(), message.c_str());
  if (reply)
    freeReplyObject(reply);
}
