<script setup lang="ts">
import { onMounted } from "vue";
import { bootstrapLegacySvgStudio, svgStudioShellHtml } from "@core";

onMounted(() => {
  void bootstrapLegacySvgStudio();
});
</script>

<template>
  <div class="svg-studio-app-host" v-html="svgStudioShellHtml"></div>
</template>
