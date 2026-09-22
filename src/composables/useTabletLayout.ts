import { onBeforeUnmount, ref } from 'vue'

// Match the CSS breakpoint by available viewport width, including Split View.
export function useTabletLayout(minWidth = 768) {
  const query = window.matchMedia(`(min-width: ${minWidth}px)`)
  const tablet = ref(query.matches)
  const update = () => { tablet.value = query.matches }
  query.addEventListener('change', update)
  onBeforeUnmount(() => query.removeEventListener('change', update))
  return tablet
}
