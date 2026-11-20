import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
 id("com.android.application")
 id("org.jetbrains.kotlin.android")
 id("org.jetbrains.kotlin.plugin.compose")
}

val supabaseUrl = providers.gradleProperty("AGRAR_SUPABASE_URL").orElse("")
val supabasePublishableKey = providers.gradleProperty("AGRAR_SUPABASE_PUBLISHABLE_KEY").orElse("")
val appVersionName = providers.gradleProperty("AGRAR_APP_VERSION_NAME").orElse("0.1.0-dev")
val appVersionCode = providers.gradleProperty("AGRAR_APP_VERSION_CODE").map{it.toInt()}.orElse(1)
val releaseKeystore = providers.gradleProperty("AGRAR_RELEASE_KEYSTORE_PATH").orElse("")
val releaseStorePassword = providers.gradleProperty("AGRAR_RELEASE_STORE_PASSWORD").orElse("")
val releaseKeyAlias = providers.gradleProperty("AGRAR_RELEASE_KEY_ALIAS").orElse("")
val releaseKeyPassword = providers.gradleProperty("AGRAR_RELEASE_KEY_PASSWORD").orElse("")
val releaseSigningReady = listOf(releaseKeystore.get(),releaseStorePassword.get(),releaseKeyAlias.get(),releaseKeyPassword.get())
 .all{it.isNotBlank()}
fun quoted(value:String)="\"${value.replace("\\","\\\\").replace("\"","\\\"")}\""

android {
 namespace = "hu.agrarmentor.android"
 compileSdk = 36

 defaultConfig {
  applicationId = "hu.agrarmentor.android"
  minSdk = 26
  targetSdk = 35
  versionCode = appVersionCode.get()
  versionName = appVersionName.get()
  testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  buildConfigField("String","SUPABASE_URL",quoted(supabaseUrl.get()))
  buildConfigField("String","SUPABASE_PUBLISHABLE_KEY",quoted(supabasePublishableKey.get()))
 }

 signingConfigs {
  if(releaseSigningReady)create("production") {
   storeFile = file(releaseKeystore.get())
   storePassword = releaseStorePassword.get()
   keyAlias = releaseKeyAlias.get()
   keyPassword = releaseKeyPassword.get()
  }
 }

 buildTypes {
  release {
   isMinifyEnabled = false
   if(releaseSigningReady)signingConfig = signingConfigs.getByName("production")
  }
 }

 buildFeatures { compose = true; buildConfig = true }
 compileOptions {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
 }
}

kotlin {
 compilerOptions {
  jvmTarget.set(JvmTarget.JVM_17)
 }
}

dependencies {
 // Compose 1.12 requires AGP 9.1 / API 37; retain an API 36-compatible BOM.
 val composeBom = platform("androidx.compose:compose-bom:2026.02.00")
 implementation(composeBom)
 androidTestImplementation(composeBom)

 implementation("androidx.activity:activity-compose:1.13.0")
 implementation("androidx.compose.ui:ui")
 implementation("androidx.compose.ui:ui-tooling-preview")
 implementation("androidx.compose.foundation:foundation")
 implementation("androidx.compose.material3:material3")
 implementation("androidx.compose.material:material-icons-extended")
 implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
 implementation("org.maplibre.gl:android-sdk:13.6.1")
 implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
 debugImplementation("androidx.compose.ui:ui-tooling")

 testImplementation("junit:junit:4.13.2")
 testImplementation("org.json:json:20240303")
 androidTestImplementation("androidx.test.ext:junit:1.3.0")
 androidTestImplementation("androidx.compose.ui:ui-test-junit4")
 debugImplementation("androidx.compose.ui:ui-test-manifest")
}
