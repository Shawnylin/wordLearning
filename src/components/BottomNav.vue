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
  ArrowUp,
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
  // 复习从记录进入，导航归属记录。
  if (route.name === "review")
    return navItems.findIndex((item) => item.name === "record");
  const index = navItems.findIndex((item) => item.name === route.name);
  return index >= 0 ? index : 0;
});

const count = navItems.length;
const shell = ref<HTMLElement>();
const position = ref(activeIndex.value);
const pressed = ref(false);
let pointerId: number | null = null;
let startX = 0;
let dragged = false;
let animationFrame = 0;
function settle(index = activeIndex.value) {
  cancelAnimationFrame(animationFrame);
  const from = position.value;
  const start = performance.now();
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360;
  function tick(now: number) {
    const progress = duration ? Math.min(1, (now - start) / duration) : 1;
    position.value = from + (index - from) * (1 - Math.pow(1 - progress, 3));
    if (progress < 1) animationFrame = requestAnimationFrame(tick);
  }
  animationFrame = requestAnimationFrame(tick);
}
function pointerPosition(clientX: number) {
  const rect = shell.value!.getBoundingClientRect();
  const cell = (shell.value!.clientWidth - 12) / count;
  return Math.max(0, Math.min(count - 1, (clientX - rect.left - shell.value!.clientLeft - 6) / cell - .5));
}
function press(event: PointerEvent) {
  if (tablet.value || compact.value || !event.isPrimary || event.button !== 0 || pointerId !== null) return;
  if (!(event.target as HTMLElement).closest('.nav-item')) return;
  cancelAnimationFrame(animationFrame);
  pointerId = event.pointerId;
  startX = event.clientX;
  dragged = false;
  pressed.value = true;
  shell.value!.setPointerCapture(event.pointerId);
}
function drag(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  if (Math.abs(event.clientX - startX) > 4) dragged = true;
  if (dragged) position.value = pointerPosition(event.clientX);
}
function release(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  const rect = shell.value!.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top - 20 && event.clientY <= rect.bottom + 20;
  const index = Math.round(pointerPosition(event.clientX));
  cancelPress();
  if (inside) { settle(index); navigateTo(navItems[index]!); }
}
function cancelPress() {
  const id = pointerId;
  pointerId = null;
  pressed.value = false;
  if (id !== null && shell.value?.hasPointerCapture(id)) shell.value.releasePointerCapture(id);
  settle();
}
function clickItem(event: MouseEvent, item: NavItem) {
  // Mobile pointer release owns navigation; preserve keyboard and assistive clicks.
  if (event.detail === 0 || tablet.value || compact.value) navigateTo(item);
}
function itemStyle(index: number) {
  const weight = Math.max(0, 1 - Math.abs(position.value - index));
  return { color: `color-mix(in srgb, var(--color-paper-ink) ${weight * 100}%, var(--ink-soft))` };
}
watch(activeIndex, () => settle());
watch([tablet, compact], () => cancelPress());

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
    : `calc((100% - 12px) * ${position.value} / ${count} + 6px)`,
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
  if (route.path === item.path) {
    document.getElementById("app")?.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
    return;
  }
  void router.push(item.path);
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
onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame);
  window.removeEventListener("daily-reading-mode", readingMode);
});
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
        ref="shell"
        :class="{ 'is-pressed': pressed }"
        @pointerdown="press" @pointermove="drag" @pointerup="release"
        @pointercancel="cancelPress" @lostpointercapture="pointerId !== null && cancelPress()"
        @contextmenu.prevent
        class="nav-shell glass-card relative flex items-center rounded-full border p-1.5"
      >
        <!-- 印章滑动指示器 -->
        <div
          id="bottom-nav-indicator"
          class="nav-indicator absolute top-1 bottom-1 rounded-full bg-zhuhong-solid"
          :style="indicatorStyle"
        />

        <!-- Nav items -->
        <button
          v-for="(item, index) in navItems"
          :key="item.name"
          @click="clickItem($event, item)"
          :style="itemStyle(index)"
          :aria-label="compact && item.name === 'report' ? '返回日报顶部' : item.label"
          :title="compact && item.name === 'report' ? '返回顶部' : item.label"
          :aria-hidden="compact && item.name !== 'report'"
          :aria-current="activeIndex === index ? 'page' : undefined"
          :tabindex="compact && item.name !== 'report' ? -1 : 0"
          class="nav-item relative z-10 flex flex-1 flex-col items-center gap-0.5 py-1.5"
          :class="[
            { 'report-item': item.name === 'report' },
            { 'before-report': index < navItems.findIndex(nav => nav.name === 'report'), 'after-report': index > navItems.findIndex(nav => nav.name === 'report') },
            activeIndex === navItems.findIndex((nav) => nav.name === item.name)
              ? 'text-paper-ink'
              : 'text-ink-soft',
          ]"
        >
          <component
            :is="compact && item.name === 'report' ? ArrowUp : item.icon"
            :size="20"
            :stroke-width="
              activeIndex ===
              navItems.findIndex((nav) => nav.name === item.name)
                ? 2.4
                : 2.1
            "
          />
          <span class="nav-label text-xs font-medium tracking-wide">{{
            compact && item.name === 'report' ? '返回顶部' : item.label
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
    max-width var(--motion-spatial-duration) cubic-bezier(0.22, 1, 0.36, 1),
    padding var(--motion-spatial-duration) cubic-bezier(0.22, 1, 0.36, 1);
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
.nav-indicator {
  pointer-events: none;
  background: linear-gradient(180deg, rgb(255 255 255 / .18), transparent 58%), color-mix(in srgb, var(--zhuhong-solid) 88%, transparent);
  border: 1px solid rgb(255 255 255 / .24);
  backdrop-filter: blur(6px) saturate(125%);
  -webkit-backdrop-filter: blur(6px) saturate(125%);
  filter: blur(.3px);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .3), inset 0 -1px 2px rgb(0 0 0 / .09), 0 2px 8px -2px color-mix(in srgb, var(--zhuhong-solid) 45%, transparent);
}
.nav-indicator::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(160deg, rgb(255 255 255 / .32), rgb(255 255 255 / .08) 48%, transparent 75%);
  box-shadow: inset 0 1px 2px rgb(255 255 255 / .55);
  opacity: 0;
  transition: opacity 180ms ease;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .nav-shell { background: var(--card); }
}
.nav-frame.compact .nav-shell {
  min-height: 52px;
}
#bottom-nav-indicator {
  transition:
    width var(--motion-spatial-duration) cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms cubic-bezier(.22,1,.36,1),
    top 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.42s ease;
}
.nav-item {
  min-width: 0;
  overflow: hidden;
  transition:
    flex var(--motion-spatial-duration) cubic-bezier(0.22, 1, 0.36, 1),
    width var(--motion-spatial-duration) cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.38s ease,
    opacity 0.42s ease,
    transform var(--motion-spatial-duration) cubic-bezier(0.22, 1, 0.36, 1);
}
.nav-item svg { color: inherit; }
.nav-shell, .nav-shell * { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.nav-shell { touch-action: none; }
.nav-shell.is-pressed #bottom-nav-indicator {
  transform: scale(1.12);
  box-shadow: inset 0 1px 2px rgb(255 255 255 / .45), inset 0 -1px 2px rgb(0 0 0 / .06), 0 4px 14px -3px color-mix(in srgb, var(--zhuhong-solid) 55%, transparent);
}
.nav-shell.is-pressed .nav-indicator::after { opacity: 1; }
.nav-item { -webkit-tap-highlight-color: transparent; }
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
  .nav-indicator::after,
  .nav-item,
  .nav-label {
    transition-duration: 1ms;
  }
}
</style>
