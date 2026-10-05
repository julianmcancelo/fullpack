// ML Pro Suite — configuración de repositorios y módulos.
// El proyecto es de módulo único: :app (paquete base com.grana3d.mlpro).

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    // Las dependencias se declaran sólo acá (nada de repositories por módulo).
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MLProSuite"

include(":app")
