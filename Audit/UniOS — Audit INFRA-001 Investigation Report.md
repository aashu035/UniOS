# INFRA-001 — Local Gradle C++ Compilation Failure

## 1. Evidence Collection

### Environment Details
* **JDK Version:** 25.0.1 (Launcher: 21.0.10)
* **Gradle Version:** 9.3.1
* **Physical RAM:** 12 GB
* **Pagefile Usage:** ~12 GB allocated (2 GB currently used)
* **NDK Version:** 27.1.12297006 (clang version 18.0.2)
* **React Native Version:** 0.85.3
* **Expo SDK Version:** 56.0.19
* **`expo-modules-core` Version:** 56.0.23

### Crash Context
* **Module:** `expo-modules-core`
* **File:** `JavaScriptModuleObject.cpp`
* **Architecture:** `arm64-v8a` (among others being built)
* **Error Output:** 
  `clang++: error: clang frontend command failed due to signal (use -v to see invocation)`
  `ninja: build stopped: subcommand failed.`

### Configuration State (Prior to failure)
* `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`
* `org.gradle.parallel=true`
* `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`

## 2. Root Cause Classification

**Classification:** **OOM (Out of Memory) / Resource Exhaustion (Windows Toolchain Failure)**

**Reasoning:**
A `clang++: error: clang frontend command failed due to signal` on Windows without an explicit C++ syntax error or linker error indicates the compiler process was abruptly terminated by the OS. 

React Native's new architecture relies heavily on complex C++ template metaprogramming (JSI/Fabric). Compiling these files requires substantial memory per `clang++` thread. 
Currently, the build is configured to:
1. Build for **4 different architectures** simultaneously (`armeabi-v7a, arm64-v8a, x86, x86_64`).
2. Run in **parallel mode** (`org.gradle.parallel=true`), meaning Gradle spawns multiple workers.
3. Allow Ninja to spawn `N + 2` compiler threads based on CPU cores.

On a system with 12 GB of physical RAM, spawning dozens of concurrent `clang++` processes for 4 architectures guarantees memory exhaustion, resulting in the OS quietly killing the compiler process with a signal.

## 3. Proposed Remediation

We do not need to change the application code, Expo version, or NDK. We only need to control the build pipeline's resource consumption.

1. **Restrict Architecture:** Change `reactNativeArchitectures=arm64-v8a` in `android/gradle.properties`. For testing on a physical device, we only need the ARM64 binary. This reduces the compilation workload by 75%.
2. **Disable Parallelism:** Set `org.gradle.parallel=false` to prevent Gradle from running multiple project builds simultaneously.
3. **Increase Gradle Daemon Memory:** Set `org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1g` to ensure the JVM overseeing the build does not crash.

*Note: I previously attempted to hot-patch the JVM and parallel settings just before the methodology was locked. If approved, I will ensure these 3 precise changes are cleanly applied to `gradle.properties` and execute a clean build.*
