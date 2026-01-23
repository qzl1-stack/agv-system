#include "rule_engine.h"
#include <algorithm>
#include <cmath>

namespace agv_core {

RuleEngine::RuleEngine() {}

RuleEngine::~RuleEngine() {}

double RuleEngine::CalcDistance(double x1, double y1, double x2, double y2) {
  return std::sqrt(std::pow(x1 - x2, 2) + std::pow(y1 - y2, 2));
}

std::vector<Alert> RuleEngine::ProcessFrame(const json &frame) {
  std::vector<Alert> alerts;

  // 提取 AGV ID
  std::string agv_id = frame.value("id", "UNKNOWN");

  // 1. 数据完整性检查
  if (!frame.contains("position") || !frame.contains("guidance")) {
    return alerts; // 数据不足，无法处理
  }

  // 2. 位置偏差检查
  try {
    auto pos = frame["position"];
    auto guide = frame["guidance"];

    double current_x = pos.value("x", 0.0);
    double current_y = pos.value("y", 0.0);
    double nav_x = guide.value("nav_x", 0.0);
    double nav_y = guide.value("nav_y", 0.0);

    double dist = CalcDistance(current_x, current_y, nav_x, nav_y);

    // 阈值: 0.5 米
    if (dist > 0.5) {
      alerts.push_back({"[" + agv_id + "] Navigation Deviation", "critical",
                        "位置偏差: " + std::to_string(dist) + " 米",
                        "检查导航传感器校准"});
    }
  } catch (...) {
    // 忽略或记录 JSON 错误
  }

  // 3. 轮速检查 (示例逻辑)
  if (frame.contains("LeftWheel") && frame.contains("RightWheel")) {
    try {
      double l_set = frame["LeftWheel"].value("left_set", 0.0);
      double l_act = frame["LeftWheel"].value("left_actual", 0.0);

      if (std::abs(l_set) > 0.1) { // 仅在移动时检查
        double diff = std::abs(l_set - l_act);
        double ratio = diff / std::abs(l_set);
        if (ratio > 0.1) { // 偏差超过 10%
          alerts.push_back({"[" + agv_id + "] Drive Anomaly", "warning",
                            "左轮速度偏差 > 10%", "检查驱动电机或编码器"});
        }
      }
    } catch (...) {
    }
  }

  // 4. 条形码检查
  if (frame.contains("barcode")) {
    int val = frame["barcode"].value("value", 0);
    if (val == -1) {
      alerts.push_back({"[" + agv_id + "] Barcode Read Fail", "error",
                        "条形码读取失败 (-1)", "检查条码阅读器镜头或码值质量"});
    }
  }

  return alerts;
}

} // namespace agv_core
