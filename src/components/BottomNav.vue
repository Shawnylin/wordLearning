<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  BookOpen,
  History,
  Newspaper,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-vue-next";
import { useTabletLayout } from '../composables/useTabletLayout';

defineProps<{ collapsed: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
const tablet = useTabletLayout();

const route = useRoute();
const router = useRouter();
const dailyCompact = ref(false);
const compact = computed(() => dailyCompact.value && !tablet.value);

interface NavItem {
  name: string;
  label: string;
  icon: typeof BookOpen;
  path: string;
}

const navItems: NavItem[] = [
  { name: "learn", label: "学习", icon: BookOpen, path: "/learn" },
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
const indicatorStyle = computed(() => tablet.value ? {
  width: 'calc(100% - 12px)', left: '6px', top: `${6 + activeIndex.value * 56}px`, height: '48px', bottom: 'auto',
} : ({
  width: compact.value
    ? "48px"
    : `calc((100% - 12px) / ${count})`,
  left: compact.value
    ? "calc(50% - 24px)"
    : `calc((100% - 12px) * ${activeIndex.value} / ${count} + 6px)`,
}));

function navigateTo(item: NavItem) {
  if (compact.value && item.name === "report") {
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
    class="app-nav fixed bottom-0 left-0 right-0 z-50"
    :class="{ 'is-collapsed': collapsed }"
    aria-label="主导航"
  >
    <button v-if="tablet" class="nav-toggle" :aria-expanded="!collapsed" aria-controls="primary-nav-items" :aria-label="collapsed ? '展开导航' : '收起导航'" @click="emit('toggle')">
      <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="20" />
      <span v-if="!collapsed">收起导航</span>
    </button>
    <div
      class="nav-frame mx-auto max-w-md px-4 pt-1"
      :class="{ compact }"
    >
      <div
        id="primary-nav-items"
        class="nav-shell glass-card relative flex items-center rounded-full border p-1.5"
      >
        <!-- 印章滑动指示器 -->
        <div
          id="bottom-nav-indicator"
          class="absolute top-1 bottom-1 rounded-full bg-zhuhong-solid shadow-[0_2px_8px_-2px_rgba(178,58,44,0.6)]"
          :style="indicatorStyle"
        />

        <!-- Nav items -->
        <button
          v-for="(item, index) in navItems"
          :key="item.name"
          @click="navigateTo(item)"
          :aria-label="compact && item.name === 'report' ? '返回日报顶部' : item.label"
          :title="item.label"
          :aria-hidden="compact && item.name !== 'report'"
          :aria-current="activeIndex === index ? 'page' : undefined"
          :tabindex="compact && item.name !== 'report' ? -1 : 0"
          class="nav-item relative z-10 flex flex-1 flex-col items-center gap-0.5 py-1.5"
          :class="[
            { 'report-item': item.name === 'report' },
            { 'before-report': index < navItems.findIndex(nav => nav.name === 'report'), 'after-report': index > navItems.findIndex(nav => nav.name === 'report') },
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
.app-nav { padding-bottom: max(10px, calc(env(safe-area-inset-bottom, 0px) - 12px)); }
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
  background: var(--nav-glass-fill);
  border-color: var(--glass-edge);
  box-shadow: var(--glass-shadow), 0 8px 30px -18px rgb(20 24 28 / .32);
  backdrop-filter: blur(22px) saturate(118%);
  -webkit-backdrop-filter: blur(22px) saturate(118%);
  transition: min-height 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .nav-shell { background: var(--card); }
}
.nav-frame.compact .nav-shell {
  min-height: 52px;
}
#bottom-nav-indicator {
  transition:
    width 0.52s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.52s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.42s ease;
}
.nav-item {
  min-width: 0;
  overflow: hidden;
  transition:
    flex 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.38s ease,
    opacity 0.42s ease,
    transform 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.3s ease;
}
.nav-frame.compact .nav-item:not(.report-item) {
  flex: 0 0 0;
  width: 0;
  padding: 0;
  opacity: 0;
  transform: scale(0.72);
  pointer-events: none;
}
.nav-frame.compact .nav-item.before-report {
  transform: translateX(24px) scale(0.72);
}
.nav-frame.compact .nav-item.after-report {
  transform: translateX(-24px) scale(0.72);
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
@media (min-width: 768px) {
  .app-nav { top: max(20px, env(safe-area-inset-top)); bottom: auto; left: max(8px, env(safe-area-inset-left)); right: auto; width: calc(var(--nav-width) - 16px); padding: 0; transition: width 420ms cubic-bezier(.22,1,.36,1); }
  .nav-toggle { display: flex; align-items: center; gap: 10px; width: 100%; height: 48px; padding-inline: 14px; margin-bottom: 16px; white-space: nowrap; overflow: hidden; border-radius: 16px; color: var(--ink-soft); }
  .nav-toggle:hover { background: var(--soft); }
  .nav-toggle svg, .nav-item svg { flex-shrink: 0; }
  .nav-frame { max-width: none; padding: 0; }
  .nav-shell { flex-direction: column; gap: 8px; border-radius: 22px; }
  #bottom-nav-indicator { border-radius: 14px; }
  .nav-item { flex: none; width: 100%; height: 48px; flex-direction: row; justify-content: flex-start; gap: 0; padding: 0 8px; border-radius: 16px; }
  .nav-label { font-size: 14px; line-height: 20px; max-height: 20px; max-width: 80px; margin-left: 12px; white-space: nowrap; transition: max-width 420ms ease, margin 420ms ease, opacity 180ms ease; }
  .is-collapsed .nav-label { max-width: 0; margin-left: 0; opacity: 0; }
  .nav-item:focus-visible, .nav-toggle:focus-visible { outline: 2px solid var(--zhuhong); outline-offset: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .nav-frame,
  .nav-shell,
  #bottom-nav-indicator,
  .nav-item,
  .nav-label {
    transition-duration: 1ms;
  }
}
</style>
