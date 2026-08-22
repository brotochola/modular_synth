class Merger extends Component {
  static name = "Merger";
  constructor(app,serializedData) {
    super(app,serializedData);
    this.infoText =
      "Channel merger. Combines up to four mono inputs into one multi-channel stream (ChannelMergerNode). Use before stereo destinations or multi-channel processing.";

    
      
    
    this.node =  new ChannelMergerNode(this.app.actx,  {
        numberOfInputs: 4,
      });
    

    // this.createInputButtons();
  }

}
