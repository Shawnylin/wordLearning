<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  BookOpen,
  GitCompare,
  History,
  Newspaper,
  User,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const dailyCompact = ref(false);

interface NavItem {
  name: string;
  label: string;
  icon: typeof BookOpen;
  path: string;
}

const navItems: NavItem[] = [
  { name: "learn", label: "学习", icon: BookOpen, path: "/learn" },
  { name: "compare", label: "对比", icon: GitCompare, path: "/compare" },
  { name: "report", label: "日报", icon: Newspaper, path: "/report" },
  { name: "record", label: "记录", icon: History, path: "/record" },
  { name: "profile", label: "个人", icon: User, path: "/profile" },
];

const activeIndex = computed(() => {
  if (route.path.startsWith("/profile"))
    return navItems.findIndex((item) => item.name === "profile");
  // 复习页归属「个人」分组，保持高亮
  if (route.name === "review")
    return navItems.findIndex((item) => item.name === "profile");
  const index = navItems.findIndex((item) => item.name === route.name);
  return index >= 0 ? index : 0;
});

const count = navItems.length;

// 指示器定位：绝对定位的百分比相对容器的 padding-box（不含 1px 边框），
// 而按钮平分的是内容区（padding-box 减去两侧 p-1.5 = 6px 内边距）。
// 因此按“100% - 12px”均分、偏移 6px，指示器才能与每个 flex-1 按钮严格同心。
const indicatorStyle = computed(() => ({
  width: dailyCompact.value
    ? "calc(100% - 8px)"
    : `calc((100% - 12px) / ${count})`,
  left: dailyCompact.value
    ? "4px"
    : `calc((100% - 12px) * ${activeIndex.value} / ${count} + 6px)`,
  transition: "left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
}));

function navigateTo(item: NavItem) {
  if (dailyCompact.value && item.name === "report") {
    document
      .getElementById("app")
      ?.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    return;
  }
  router.push(item.path);
  document.getElementById("app")?.scrollTo({ top: 0, behavior: "smooth" });
}
function readingMode(event: Event) {
  dailyCompact.value =
    route.name === "report" &&
    !!(event as CustomEvent<{ compact: boolean }>).detail?.compact;
}
watch(
  () => route.name,
  (name) => {
    if (name !== "report") dailyCompact.value = false;
  },
);
onMounted(() => window.addEventListener("daily-reading-mode", readingMode));
onBeforeUnmount(() =>
  window.removeEventListener("daily-reading-mode", readingMode),
);
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50"
    style="
      padding-bottom: max(10px, calc(env(safe-area-inset-bottom, 0px) - 12px));
    "
  >
    <div
      class="nav-frame mx-auto max-w-md px-4 pt-1"
      :class="{ compact: dailyCompact }"
    >
      <div
        class="nav-shell relative flex items-center rounded-full bg-card/95 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(42,36,28,0.4)] border border-line p-1.5"
      >
        <!-- 印章滑动指示器 -->
        <div
          id="bottom-nav-indicator"
          class="absolute top-1 bottom-1 rounded-full bg-zhuhong-solid shadow-[0_2px_8px_-2px_rgba(178,58,44,0.6)]"
          :style="indicatorStyle"
        />

        <!-- Nav items -->
        <button
          v-for="item in navItems"
          :key="item.name"
          @click="navigateTo(item)"
          :aria-label="dailyCompact && item.name === 'report' ? '返回日报顶部' : item.label"
          :aria-hidden="dailyCompact && item.name !== 'report'"
          :tabindex="dailyCompact && item.name !== 'report' ? -1 : 0"
          class="nav-item relative z-10 flex flex-1 flex-col items-center gap-0.5 py-1.5"
          :class="[
            { 'report-item': item.name === 'report' },
            activeIndex === navItems.findIndex((nav) => nav.name === item.name)
              ? 'text-paper-ink'
              : 'text-ink-mute',
          ]"
        >
          <component
            :is="item.icon"
            :size="20"
            :stroke-width="
              activeIndex ===
              navItems.findIndex((nav) => nav.name === item.name)
                ? 2.4
                : 1.8
            "
          />
          <span class="nav-label text-[11px] font-medium tracking-wide">{{
            item.label
          }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.nav-frame {
  transition:
    max-width 0.52s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.52s cubic-bezier(0.22, 1, 0.36, 1);
}
.nav-frame.compact {
  max-width: 72px;
  padding-left: 8px;
  padding-right: 8px;
}
.nav-shell {
  min-height: 52px;
  transition: min-height 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
.nav-frame.compact .nav-shell {
  min-height: 52px;
}
.nav-item {
  min-width: 0;
  overflow: hidden;
  transition:
    flex 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.38s ease,
    opacity 0.24s ease,
    transform 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.3s ease;
}
.nav-frame.compact .nav-item:not(.report-item) {
  flex: 0 0 0;
  width: 0;
  padding: 0;
  opacity: 0;
  transform: scale(0.5);
  pointer-events: none;
}
.nav-label {
  max-height: 16px;
  opacity: 1;
  transition:
    max-height 0.3s ease,
    opacity 0.2s ease,
    transform 0.35s ease;
}
.nav-frame.compact .nav-label {
  max-height: 0;
  opacity: 0;
  transform: translateY(5px);
}
@media (prefers-reduced-motion: reduce) {
  .nav-frame,
  .nav-shell,
  .nav-item,
  .nav-label {
    transition-duration: 1ms;
  }
}
</style>
