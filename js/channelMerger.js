class Merger extends Component {
  constructor(app) {
    super(app, "merger");

    
      
    
    this.node =  new ChannelMergerNode(this.app.actx,  {
        numberOfInputs: 4,
      });
    this.node.parent = this;

    this.createInputButtons();
  }

}
