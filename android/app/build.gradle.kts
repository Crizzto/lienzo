// La app es una envoltura nativa (Java, sin librerías) de las mismas páginas web que usa Lienzo en Windows:
// la carpeta web/ del repositorio entra tal cual como «assets».
plugins {
    id("com.android.application")
}

// La versión vive en un solo lugar: src/Ensamblado.cs (AssemblyInformationalVersion), igual que en Windows.
val versionLienzo: String = Regex("""AssemblyInformationalVersion\("([^"]+)"\)""")
    .find(rootProject.file("../src/Ensamblado.cs").readText())?.groupValues?.get(1) ?: "1.0.0"
val codigoVersion: Int = versionLienzo.split(".").mapNotNull { it.toIntOrNull() }.let { p ->
    (p.getOrElse(0) { 1 } * 10000) + (p.getOrElse(1) { 0 } * 100) + p.getOrElse(2) { 0 }
}

android {
    namespace = "app.lienzo"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.lienzo"
        minSdk = 31          // Android 12: Material You toma los colores del fondo
        targetSdk = 36
        versionCode = codigoVersion
        versionName = versionLienzo
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Firmado con la llave de depuración de este equipo: sirve para instalarlo a mano (no para la Play Store).
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            assets.srcDirs(rootProject.file("../web"))
        }
    }
}
