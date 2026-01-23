#ifndef AGV_RULE_ENGINE_SRC_RULE_ENGINE_H_
#define AGV_RULE_ENGINE_SRC_RULE_ENGINE_H_

#include <string>
#include <vector>
#include <memory>
#include "json.hpp"

namespace agv_core {

using json = nlohmann::json;

struct Alert {
    std::string type;
    std::string level; // "info", "warning", "critical"
    std::string msg;
    std::string suggestion;
};

class RuleEngine {
 public:
    RuleEngine();
    ~RuleEngine();

    // Process a single frame and return a list of alerts
    std::vector<Alert> ProcessFrame(const json& frame);

 private:
    double CalcDistance(double x1, double y1, double x2, double y2);
};

}  // namespace agv_core

#endif  // AGV_RULE_ENGINE_SRC_RULE_ENGINE_H_
