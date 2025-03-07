class AppState {
  public isQuitting = false

  public setIsQuitting(isQuitting: boolean) {
    this.isQuitting = isQuitting
  }
}

export default new AppState()
