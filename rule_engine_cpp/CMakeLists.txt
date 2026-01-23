cmake_minimum_required(VERSION 3.14)
project(AgvRuleEngine)

set(CMAKE_CXX_STANDARD 17)

# Fix for "Compatibility with CMake < 3.5 has been removed" error
set(CMAKE_POLICY_VERSION_MINIMUM 3.5)

# --- Fetch Hiredis automatically ---
include(FetchContent)

message(STATUS "Downloading hiredis...")
FetchContent_Declare(
  hiredis
  GIT_REPOSITORY https://github.com/redis/hiredis.git
  GIT_TAG        v1.2.0
)
FetchContent_MakeAvailable(hiredis)

# Force hiredis to use gnu99 (C only)
if(MINGW)
    target_compile_options(hiredis PRIVATE -std=gnu99)
endif()

# Add hiredis source dir to includes so <hiredis/hiredis.h> works
include_directories(include ${hiredis_SOURCE_DIR})

add_executable(rule_engine 
    src/main.cc 
    src/rule_engine.cc 
    src/redis_client.cc
)

target_link_libraries(rule_engine PRIVATE hiredis)

if(WIN32)
    target_link_libraries(rule_engine PRIVATE Ws2_32)
endif()
