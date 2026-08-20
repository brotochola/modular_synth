class Merger extends Component {
  static name = "Merger";
  constructor(app,serializedData) {
    super(app,serializedData);

    
      
    
    this.node =  new ChannelMergerNode(this.app.actx,  {
        numberOfInputs: 4,
      });
    

    // this.createInputButtons();
  }

}
