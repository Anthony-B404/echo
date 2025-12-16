export const useThemeStore = defineStore("theme", {
  state: () => ({
    primaryColor: "green",
    neutralColor: "slate",
  }),

  actions: {
    setPrimaryColor(color: string) {
      this.primaryColor = color;
      localStorage.setItem("theme_primary", color);
      const appConfig = useAppConfig();
      appConfig.ui.colors.primary = color;
    },

    setNeutralColor(color: string) {
      this.neutralColor = color;
      localStorage.setItem("theme_neutral", color);
      const appConfig = useAppConfig();
      appConfig.ui.colors.neutral = color;
    },

    restoreTheme() {
      const primary = localStorage.getItem("theme_primary");
      const neutral = localStorage.getItem("theme_neutral");
      const appConfig = useAppConfig();

      if (primary) {
        this.primaryColor = primary;
        appConfig.ui.colors.primary = primary;
      }
      if (neutral) {
        this.neutralColor = neutral;
        appConfig.ui.colors.neutral = neutral;
      }
    },
  },
});
